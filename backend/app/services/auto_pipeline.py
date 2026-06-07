"""
Auto-pipeline: runs the full blood coordination cycle autonomously.
- Step 1: Run daily predictions for all patients
- Step 2: For each urgent prediction (<=3 days), auto-create request if none active
- Step 3: Auto-match top 5 donors for every pending/unmatched request
- Step 4: Auto-generate + auto-approve outreach messages
- Step 5: Learns from history — updates donor availability patterns, response rates
- Step 6: After 90-day eligibility gap, auto-reset donor availability
"""
from __future__ import annotations

import json
import threading
import time
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.database import (
    BloodRequest, Donor, DonorHistory, MatchResult,
    Notification, OutreachHistory, SessionLocal
)
from app.services.kinesis_service import (
    event_pipeline_run, event_donation_completed,
    event_appointment_scheduled, get_kinesis_status
)
from app.services.dynamodb_service import (
    record_pipeline_run, cache_donor_availability, get_dynamodb_status
)


# ─── Eligibility Reset ──────────────────────────────────────────────────────

def reset_eligible_donors(db: Session) -> int:
    """Auto-reset donors whose 90-day cooldown has passed."""
    today = date.today()
    donors = db.query(Donor).filter(Donor.availability_status == "unavailable").all()
    reset_count = 0
    for donor in donors:
        if donor.next_eligible_date and donor.next_eligible_date <= today:
            donor.availability_status = "available"
            reset_count += 1
    if reset_count:
        db.commit()
    return reset_count


# ─── Pattern Learning ────────────────────────────────────────────────────────

def update_donor_patterns(db: Session, donor_id: int, response_time_hours: float, time_slot: str) -> None:
    """Update donor's learned availability pattern from a confirmed donation."""
    donor = db.query(Donor).filter(Donor.id == donor_id).first()
    if not donor:
        return

    try:
        pattern = json.loads(donor.availability_pattern or "{}")
    except Exception:
        pattern = {}

    weekday = datetime.utcnow().strftime("%A")
    slots = pattern.get(weekday, [])
    if time_slot and time_slot not in slots:
        slots.append(time_slot)
    pattern[weekday] = slots

    # Update rolling average response time
    if donor.avg_response_hours and donor.avg_response_hours > 0:
        donor.avg_response_hours = round((donor.avg_response_hours + response_time_hours) / 2, 1)
    else:
        donor.avg_response_hours = response_time_hours

    donor.availability_pattern = json.dumps(pattern)
    db.commit()


def record_completed_donation(db: Session, request_id: int) -> None:
    """When a donation is completed, record in DonorHistory and update donor stats."""
    match = db.query(MatchResult).filter(
        MatchResult.request_id == request_id,
        MatchResult.status == "appointed"
    ).first()
    if not match:
        return

    donor = match.donor
    req = match.blood_request
    patient = req.patient if req else None

    # Calculate response time (time from notification sent to response)
    notif = db.query(Notification).filter(
        Notification.request_id == request_id,
        Notification.donor_id == donor.id,
        Notification.status.in_(["responded"])
    ).first()

    response_hours = 0.0
    if notif and notif.sent_at and notif.responded_at:
        delta = notif.responded_at - notif.sent_at
        response_hours = round(delta.total_seconds() / 3600, 2)

    history = DonorHistory(
        donor_id=donor.id,
        request_id=request_id,
        patient_name=patient.name if patient else "",
        blood_group=req.blood_group if req else donor.blood_group,
        hospital=patient.hospital if patient else "",
        city=patient.city if patient else "",
        donation_date=match.donation_date or date.today(),
        time_slot=match.scheduled_time or "",
        response_time_hours=response_hours,
        auto_confirmed=True,
    )
    db.add(history)

    # Update donor smart fields
    donor.donation_count = (donor.donation_count or 0) + 1
    donor.total_donations_completed = (donor.total_donations_completed or 0) + 1
    donor.last_donation_date = date.today()
    donor.next_eligible_date = date.today() + timedelta(days=90)

    # Update response rate
    total_notifs = db.query(Notification).filter(Notification.donor_id == donor.id).count()
    responded = db.query(Notification).filter(
        Notification.donor_id == donor.id,
        Notification.status == "responded"
    ).count()
    if total_notifs > 0:
        donor.response_rate = round(responded / total_notifs, 3)

    # Update patient's last transfusion date to reset the cycle
    if patient:
        patient.last_transfusion_date = match.donation_date or date.today()

    db.commit()

    # Update availability pattern
    update_donor_patterns(db, donor.id, response_hours, match.scheduled_time or "")


# ─── Full Auto Pipeline ───────────────────────────────────────────────────────

def run_auto_pipeline(db: Session) -> dict:
    """
    Full autonomous pipeline:
    1. Reset eligible donors
    2. Run predictions for all patients
    3. Auto-create requests for urgent predictions
    4. Auto-match + auto-outreach for pending requests
    5. Auto-approve all outreach messages
    """
    results = {
        "run_at": datetime.utcnow().isoformat(),
        "donors_reset": 0,
        "predictions_run": 0,
        "requests_auto_created": 0,
        "requests_matched": 0,
        "outreach_sent": 0,
        "outreach_approved": 0,
        "errors": []
    }

    # Step 1: Reset eligible donors
    try:
        results["donors_reset"] = reset_eligible_donors(db)
    except Exception as e:
        results["errors"].append(f"Reset donors: {e}")

    # Step 2: Run predictions
    try:
        from app.services.prediction_service import run_daily_predictions
        pred_result = run_daily_predictions(db)
        results["predictions_run"] = pred_result.get("predictions_created", 0)
        results["requests_auto_created"] = pred_result.get("auto_requests_created", 0)
    except Exception as e:
        results["errors"].append(f"Predictions: {e}")

    # Step 3: Find all pending requests without matches and auto-match + outreach
    try:
        from app.services.matching_service import match_donors_for_request
        from app.services.notification_service import send_outreach_for_request, approve_outreach

        pending_reqs = db.query(BloodRequest).filter(
            BloodRequest.status.in_(["Pending", "Searching Donors"])
        ).all()

        for req in pending_reqs:
            try:
                # Check if already has notifications
                existing_notifs = db.query(Notification).filter(
                    Notification.request_id == req.id,
                    Notification.status.in_(["pending_review", "sent"])
                ).count()

                if existing_notifs > 0:
                    # Already has outreach — just ensure approved
                    pending_review = db.query(Notification).filter(
                        Notification.request_id == req.id,
                        Notification.status == "pending_review"
                    ).count()
                    if pending_review > 0:
                        approve_outreach(db, req.id)
                        results["outreach_approved"] += pending_review
                    continue

                # Check if already matched
                existing_matches = db.query(MatchResult).filter(
                    MatchResult.request_id == req.id
                ).count()

                if existing_matches == 0:
                    match_donors_for_request(db, req.id, top_n=5)
                    results["requests_matched"] += 1

                # Auto-send outreach
                notifs = send_outreach_for_request(db, req.id)
                results["outreach_sent"] += len(notifs)

                # Auto-approve outreach (coordinator bypass in auto mode)
                approve_outreach(db, req.id)
                results["outreach_approved"] += len(notifs)

            except Exception as e:
                results["errors"].append(f"Request #{req.id}: {e}")

    except Exception as e:
        results["errors"].append(f"Pipeline loop: {e}")

    # Publish to Kinesis
    try:
        event_pipeline_run(
            run_at=results["run_at"],
            predictions=results["predictions_run"],
            requests_created=results["requests_auto_created"],
            matched=results["requests_matched"],
            outreach=results["outreach_sent"],
        )
    except Exception as e:
        results["errors"].append(f"Kinesis publish: {e}")

    # Record in DynamoDB
    try:
        record_pipeline_run(results)
    except Exception as e:
        results["errors"].append(f"DynamoDB record: {e}")

    # Add AWS service status to results
    from app.services.stepfunctions_service import get_step_functions_status
    results["aws_services"] = {
        "kinesis": get_kinesis_status(),
        "dynamodb": get_dynamodb_status(),
        "stepfunctions": get_step_functions_status(),
    }

    return results


# ─── Background Scheduler ─────────────────────────────────────────────────────

_pipeline_thread: threading.Thread | None = None
_pipeline_running = False
_last_run_result: dict | None = None
_pipeline_interval_seconds = 300  # 5 minutes


def get_pipeline_status() -> dict:
    from app.services.stepfunctions_service import get_step_functions_status
    return {
        "running": _pipeline_running,
        "interval_seconds": _pipeline_interval_seconds,
        "last_run": _last_run_result,
        "stepfunctions": get_step_functions_status(),
    }


def _pipeline_loop():
    global _pipeline_running, _last_run_result
    while _pipeline_running:
        db = SessionLocal()
        try:
            _last_run_result = run_auto_pipeline(db)
        except Exception as e:
            _last_run_result = {"error": str(e), "run_at": datetime.utcnow().isoformat()}
        finally:
            db.close()
        # Sleep in small chunks so stop is responsive
        for _ in range(_pipeline_interval_seconds):
            if not _pipeline_running:
                break
            time.sleep(1)


def start_pipeline_scheduler():
    global _pipeline_thread, _pipeline_running
    if _pipeline_running:
        return
    _pipeline_running = True
    _pipeline_thread = threading.Thread(target=_pipeline_loop, daemon=True)
    _pipeline_thread.start()


def stop_pipeline_scheduler():
    global _pipeline_running
    _pipeline_running = False


def run_pipeline_once() -> dict:
    """Run the pipeline a single time synchronously."""
    db = SessionLocal()
    try:
        result = run_auto_pipeline(db)
        global _last_run_result
        _last_run_result = result
        return result
    finally:
        db.close()

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import BloodRequest, Donor, Patient, get_db
from app.services.dashboard_service import get_dashboard
from app.services.matching_service import get_matches_for_request, match_donors_for_request
from app.services.analytics_service import get_analytics
from app.services.message_service import generate_ai_message, get_donor_memory
from app.services.notification_service import (
    approve_outreach,
    check_escalation,
    complete_request,
    get_request_outreach_status,
    record_donor_response,
    send_outreach_for_request,
)
from app.services.prediction_service import (
    create_request_from_prediction,
    get_stored_predictions,
    get_upcoming_predictions,
    predict_for_patient,
    run_daily_predictions,
)
from app.services.seed import seed_database
from app.services.auto_pipeline import (
    get_pipeline_status,
    run_pipeline_once,
    start_pipeline_scheduler,
    stop_pipeline_scheduler,
    record_completed_donation,
)
from app.services.bedrock_service import (
    get_bedrock_status,
    generate_outreach_message,
    analyze_patient_urgency,
    generate_donor_ranking_explanation,
    handle_donor_conversation,
)
from app.services.dynamodb_service import (
    get_dynamodb_status,
    get_pipeline_run_history,
    get_conversation_history,
)
from app.services.kinesis_service import (
    get_kinesis_status,
    get_recent_events,
    publish_event,
)
from app.services.stepfunctions_service import (
    get_step_functions_status,
    trigger_state_machine_execution,
)


router = APIRouter()



class PatientCreate(BaseModel):
    name: str
    blood_group: str
    hospital: str
    city: str = "Hyderabad"
    last_transfusion_date: date | None = None
    avg_gap_days: int = 21
    medical_notes: str = ""
    latitude: float = 17.39
    longitude: float = 78.46


class DonorCreate(BaseModel):
    name: str
    blood_group: str
    city: str = "Hyderabad"
    contact: str = ""
    availability_status: str = "available"
    preferred_language: str = "English"
    preferred_channel: str = "WhatsApp"
    preferred_time_period: str = "Evening"


class PredictRequest(BaseModel):
    patient_id: int | None = None
    last_transfusion_date: date | None = None
    avg_gap_days: int = 18


class MatchRequest(BaseModel):
    request_id: int


class GenerateMessageRequest(BaseModel):
    donor_id: int
    request_id: int | None = None
    blood_group: str | None = None
    city: str = "Hyderabad"
    hospital: str = "Apollo Hospital"
    urgency: str = "normal"


class BloodRequestCreate(BaseModel):
    patient_id: int
    blood_group: str | None = None
    quantity: int = 1
    urgency: str = "normal"
    required_date: date | None = None


class DonorResponse(BaseModel):
    response: str


@router.post("/seed")
def seed(force: bool = False):
    return seed_database(force=force)


@router.get("/dashboard/v2")
def dashboard_v2(db: Session = Depends(get_db)):
    return get_dashboard(db)


# --- Patients ---
@router.get("/patients")
def list_patients(
    db: Session = Depends(get_db),
    limit: int = Query(50, le=500),
    offset: int = 0,
):
    total = db.query(Patient).count()
    rows = db.query(Patient).offset(offset).limit(limit).all()
    return {
        "total": total,
        "patients": [
            {
                "id": p.id,
                "name": p.name,
                "blood_group": p.blood_group,
                "hospital": p.hospital,
                "city": p.city,
                "last_transfusion_date": str(p.last_transfusion_date) if p.last_transfusion_date else None,
                "avg_gap_days": p.avg_gap_days,
                "medical_notes": p.medical_notes or "",
            }
            for p in rows
        ],
    }


@router.post("/patients")
def create_patient(body: PatientCreate, db: Session = Depends(get_db)):
    p = Patient(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "name": p.name, "blood_group": p.blood_group}


@router.get("/patients/{patient_id}/appointments")
def get_patient_appointments(patient_id: int, db: Session = Depends(get_db)):
    from app.database import MatchResult, BloodRequest
    matches = db.query(MatchResult).join(BloodRequest).filter(
        BloodRequest.patient_id == patient_id,
        MatchResult.status == "appointed"
    ).all()
    return {
        "appointments": [
            {
                "match_id": m.id,
                "request_id": m.request_id,
                "donor_name": m.donor.name if m.donor else "Unknown",
                "donor_blood_group": m.donor.blood_group if m.donor else "",
                "donor_contact": m.donor.contact if m.donor else "",
                "scheduled_time": m.scheduled_time or "",
                "donation_date": str(m.donation_date) if m.donation_date else "",
                "hospital": m.blood_request.patient.hospital if m.blood_request.patient else "",
            }
            for m in matches
        ]
    }


@router.get("/patients/{patient_id}")
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(404, "Patient not found")
    return {
        "id": p.id,
        "name": p.name,
        "blood_group": p.blood_group,
        "hospital": p.hospital,
        "city": p.city,
        "last_transfusion_date": str(p.last_transfusion_date) if p.last_transfusion_date else None,
        "avg_gap_days": p.avg_gap_days,
        "medical_notes": p.medical_notes or "",
        "latitude": p.latitude,
        "longitude": p.longitude,
    }


# --- Hackathon canonical APIs ---
@router.post("/predict")
def predict(body: PredictRequest, db: Session = Depends(get_db)):
    from app.database import Prediction
    if body.patient_id:
        p = db.query(Patient).filter(Patient.id == body.patient_id).first()
        if not p:
            raise HTTPException(404, "Patient not found")
        pred = predict_for_patient(p)
        # Store the prediction in DB for traceability
        pr = Prediction(
            patient_id=p.id,
            predicted_date=pred["predicted_date"],
            confidence=pred["confidence"],
            days_until=pred["days_until"],
        )
        db.add(pr)
        db.commit()
        db.refresh(pr)
        return {
            "patient_id": p.id,
            "patient_name": p.name,
            "blood_group": p.blood_group,
            "last_transfusion_date": str(p.last_transfusion_date) if p.last_transfusion_date else None,
            "avg_gap_days": p.avg_gap_days,
            "predicted_need_date": str(pred["predicted_date"]),
            "confidence": pred["confidence"],
            "days_until": pred["days_until"],
            "prediction_id": pr.id,
            "model_used": "cycle_regression_v1",
        }
    if not body.last_transfusion_date:
        raise HTTPException(400, "Provide patient_id or last_transfusion_date")
    from app.database import Patient as P
    tmp = P(last_transfusion_date=body.last_transfusion_date, avg_gap_days=body.avg_gap_days)
    pred = predict_for_patient(tmp)
    return {
        "last_transfusion_date": str(body.last_transfusion_date),
        "avg_gap_days": body.avg_gap_days,
        "predicted_need_date": str(pred["predicted_date"]),
        "confidence": pred["confidence"],
        "days_until": pred["days_until"],
        "model_used": "cycle_regression_v1",
    }


@router.post("/match")
def match_hackathon(body: MatchRequest, db: Session = Depends(get_db)):
    try:
        results = match_donors_for_request(db, body.request_id, top_n=5)
    except ValueError as e:
        raise HTTPException(404, str(e))
    matches = get_matches_for_request(db, body.request_id)
    latest_round = max((m["round"] for m in matches), default=1) if matches else 1
    top = [m for m in matches if m["round"] == latest_round][:5]
    return {
        "request_id": body.request_id,
        "ranked_donors": [
            {"rank": m["rank"], "name": m["donor_name"], "score": m["score"], "blood_group": m["blood_group"]}
            for m in top
        ],
        "matches": matches,
        "count": len(results),
    }


@router.post("/generate-message")
def generate_message(body: GenerateMessageRequest, db: Session = Depends(get_db)):
    try:
        return generate_ai_message(
            db, body.donor_id, body.request_id, body.blood_group, body.city, body.hospital, body.urgency
        )
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/donors")
def list_donors_canonical(
    db: Session = Depends(get_db),
    blood_group: str | None = None,
    available_only: bool = False,
    limit: int = Query(50, le=500),
    offset: int = 0,
):
    return list_donors_v2(db, blood_group, available_only, limit, offset)


@router.post("/donors")
def create_donor(body: DonorCreate, db: Session = Depends(get_db)):
    d = Donor(**body.model_dump())
    db.add(d)
    db.commit()
    db.refresh(d)
    return {"id": d.id, "name": d.name}


@router.get("/analytics")
def analytics(db: Session = Depends(get_db)):
    return get_analytics(db)


@router.get("/donors/{donor_id}/memory")
def donor_memory(donor_id: int, db: Session = Depends(get_db)):
    mem = get_donor_memory(db, donor_id)
    if not mem:
        raise HTTPException(404, "Donor not found")
    return mem


@router.post("/requests/{request_id}/approve")
def approve_request_outreach(request_id: int, db: Session = Depends(get_db)):
    try:
        return approve_outreach(db, request_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/requests/{request_id}/complete")
def mark_complete(request_id: int, db: Session = Depends(get_db)):
    try:
        req = complete_request(db, request_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"id": req.id, "status": req.status}


@router.post("/demo/rahul-story")
def demo_rahul_story(db: Session = Depends(get_db)):
    """End-to-end demo: Rahul prediction → request → match → outreach."""
    rahul = db.query(Patient).filter(Patient.name.like("%Rahul%")).first()
    if not rahul:
        rahul = db.query(Patient).first()
    if not rahul:
        raise HTTPException(404, "No patients — run seed first")

    pred = predict_for_patient(rahul)
    req = BloodRequest(
        patient_id=rahul.id,
        blood_group=rahul.blood_group,
        quantity=1,
        status="Pending",
        urgency="high" if pred["days_until"] <= 3 else "normal",
        source="demo",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    match_donors_for_request(db, req.id, top_n=5)
    notifs = send_outreach_for_request(db, req.id)
    matches = get_matches_for_request(db, req.id)

    return {
        "story": "Rahul demo workflow complete",
        "patient": rahul.name,
        "prediction": {
            "last_transfusion": str(rahul.last_transfusion_date),
            "avg_gap_days": rahul.avg_gap_days,
            "predicted_need_date": str(pred["predicted_date"]),
            "days_until": pred["days_until"],
        },
        "request_id": req.id,
        "top_donors": [
            {"rank": m["rank"], "name": m["donor_name"], "score": m["score"]}
            for m in matches[:5]
        ],
        "messages_generated": len(notifs),
        "next_step": "Coordinator reviews messages in Outreach Studio → Approve → Simulate donor YES → Complete",
    }


# --- Donors (DB) ---
@router.get("/donors/v2")
def list_donors_v2(
    db: Session = Depends(get_db),
    blood_group: str | None = None,
    available_only: bool = False,
    limit: int = Query(50, le=500),
    offset: int = 0,
):
    q = db.query(Donor)
    if blood_group:
        q = q.filter(Donor.blood_group == blood_group)
    if available_only:
        q = q.filter(Donor.availability_status == "available")
    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    return {
        "total": total,
        "donors": [
            {
                "id": d.id,
                "name": d.name,
                "blood_group": d.blood_group,
                "city": d.city,
                "contact": d.contact,
                "availability_status": d.availability_status,
                "donation_count": d.donation_count,
                "preferred_language": d.preferred_language,
                "preferred_channel": d.preferred_channel,
                "preferred_time": d.preferred_time_period or "Morning",
                "response_rate": d.response_rate,
            }
            for d in rows
        ],
    }


@router.get("/donors/v2/{donor_id}")
def get_donor_v2(donor_id: int, db: Session = Depends(get_db)):
    d = db.query(Donor).filter(Donor.id == donor_id).first()
    if not d:
        raise HTTPException(404, "Donor not found")
    return {
        "id": d.id,
        "name": d.name,
        "blood_group": d.blood_group,
        "city": d.city,
        "contact": d.contact,
        "availability_status": d.availability_status,
        "donation_count": d.donation_count,
        "preferred_language": d.preferred_language,
        "preferred_channel": d.preferred_channel,
        "preferred_contact_hour": d.preferred_contact_hour,
        "response_rate": d.response_rate,
    }


# --- Predictions ---
@router.post("/predictions/run")
def run_predictions(db: Session = Depends(get_db)):
    return run_daily_predictions(db)


@router.get("/predictions/upcoming")
def upcoming_predictions(within_days: int = 30, db: Session = Depends(get_db)):
    preds = get_upcoming_predictions(db, within_days)
    return {"count": len(preds), "predictions": preds}


@router.get("/predictions/stored")
def stored_predictions(limit: int = 50, db: Session = Depends(get_db)):
    return {"predictions": get_stored_predictions(db, limit)}


@router.post("/predictions/{patient_id}/create-request")
def prediction_create_request(patient_id: int, db: Session = Depends(get_db)):
    try:
        req = create_request_from_prediction(db, patient_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"request_id": req.id, "status": req.status, "blood_group": req.blood_group}


# --- Blood Requests ---
@router.get("/requests")
def list_requests(
    status: str | None = None,
    db: Session = Depends(get_db),
    limit: int = Query(50, le=200),
):
    q = db.query(BloodRequest)
    if status:
        q = q.filter(BloodRequest.status == status)
    total = q.count()
    rows = q.order_by(BloodRequest.created_at.desc()).limit(limit).all()
    return {
        "total": total,
        "requests": [
            {
                "id": r.id,
                "patient_id": r.patient_id,
                "patient_name": r.patient.name if r.patient else "",
                "blood_group": r.blood_group,
                "quantity": r.quantity,
                "status": r.status,
                "urgency": r.urgency,
                "source": r.source,
                "escalation_round": r.escalation_round,
                "required_date": str(r.required_date) if r.required_date else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.post("/requests")
def create_request(body: BloodRequestCreate, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    
    req_date = body.required_date
    if not req_date:
        req_date = date.today() + timedelta(days=3)

    req = BloodRequest(
        patient_id=body.patient_id,
        blood_group=body.blood_group or patient.blood_group,
        quantity=body.quantity,
        status="Pending",
        urgency=body.urgency,
        source="manual",
        required_date=req_date,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"id": req.id, "status": req.status}


@router.get("/requests/{request_id}")
def get_request(request_id: int, db: Session = Depends(get_db)):
    r = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not r:
        raise HTTPException(404, "Request not found")
    return {
        "id": r.id,
        "patient_id": r.patient_id,
        "patient_name": r.patient.name if r.patient else "",
        "blood_group": r.blood_group,
        "status": r.status,
        "urgency": r.urgency,
        "escalation_round": r.escalation_round,
    }


# --- Matching ---
@router.post("/requests/{request_id}/match")
def run_match(request_id: int, db: Session = Depends(get_db)):
    try:
        results = match_donors_for_request(db, request_id, top_n=5)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {
        "request_id": request_id,
        "matches": get_matches_for_request(db, request_id),
        "count": len(results),
    }


@router.get("/requests/{request_id}/matches")
def get_matches(request_id: int, db: Session = Depends(get_db)):
    return {"matches": get_matches_for_request(db, request_id)}


# --- Outreach & Notifications ---
@router.post("/requests/{request_id}/outreach")
def run_outreach(request_id: int, db: Session = Depends(get_db)):
    try:
        notifs = send_outreach_for_request(db, request_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {
        "request_id": request_id,
        "notifications_sent": len(notifs),
        "notifications": [
            {
                "id": n.id,
                "donor_id": n.donor_id,
                "channel": n.channel,
                "message": n.message,
                "status": n.status,
            }
            for n in notifs
        ],
    }


@router.get("/requests/{request_id}/outreach")
def outreach_status(request_id: int, db: Session = Depends(get_db)):
    try:
        return get_request_outreach_status(db, request_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/notifications/{notification_id}/respond")
def respond_notification(notification_id: int, body: DonorResponse, db: Session = Depends(get_db)):
    try:
        notif = record_donor_response(db, notification_id, body.response)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"id": notif.id, "status": notif.status, "response": notif.donor_response}


@router.post("/requests/{request_id}/escalate")
def escalate_request(request_id: int, db: Session = Depends(get_db)):
    try:
        return check_escalation(db, request_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/notifications")
def list_notifications(db: Session = Depends(get_db), limit: int = 50):
    from app.database import Notification
    rows = db.query(Notification).order_by(Notification.sent_at.desc()).limit(limit).all()
    return {
        "notifications": [
            {
                "id": n.id,
                "request_id": n.request_id,
                "donor_name": n.donor.name if n.donor else "",
                "channel": n.channel,
                "status": n.status,
                "donor_response": n.donor_response,
                "sent_at": n.sent_at.isoformat() if n.sent_at else None,
            }
            for n in rows
        ]
    }


# --- Protocol Engine (backed by DB stats) ---
@router.get("/protocol")
def get_protocol(db: Session = Depends(get_db)):
    """Returns current outreach protocol config + live stats."""
    from app.database import BloodRequest, Notification
    total_notifications = db.query(Notification).count()
    responded = db.query(Notification).filter(Notification.status == "responded").count()
    declined = db.query(Notification).filter(Notification.status == "declined").count()
    escalated = db.query(BloodRequest).filter(BloodRequest.escalation_round > 1).count()
    response_rate = round(responded / max(1, total_notifications), 2)
    # Adaptive protocol: escalation_hours decreases if response_rate < 0.5
    escalation_hours = 6 if response_rate >= 0.5 else 4
    donors_per_round = 5 if response_rate >= 0.5 else 7
    return {
        "version": max(1, escalated + 1),
        "max_outreach_rounds": 5,
        "donors_per_round": donors_per_round,
        "escalation_hours": escalation_hours,
        "retry_interval_minutes": 90,
        "channels": ["WhatsApp", "SMS", "Email"],
        "live_stats": {
            "total_notifications": total_notifications,
            "responded": responded,
            "declined": declined,
            "response_rate_pct": round(response_rate * 100, 1),
            "requests_escalated": escalated,
        },
        "notes": f"Protocol auto-adapted: response_rate={response_rate:.0%}, escalation_hours={escalation_hours}h",
    }


_failure_log: list[dict] = []


@router.get("/protocol/failures")
def get_failures():
    """Returns simulated failure learning log (in-memory)."""
    return {"failures": _failure_log}


@router.post("/protocol/failure")
def simulate_failure(bridge_id: str = "demo-bridge-001", blood_group: str = "O Positive", db: Session = Depends(get_db)):
    """Simulates a protocol failure event and records a protocol improvement."""
    from app.database import Notification
    notif_count = db.query(Notification).count()
    responded = db.query(Notification).filter(Notification.status == "responded").count()
    new_version = len(_failure_log) + 2
    entry = {
        "trigger": f"Simulated 6h escalation failure — {blood_group}",
        "bridge_id": bridge_id,
        "blood_group": blood_group,
        "outreach_count": notif_count,
        "responses": responded,
        "duration_hours": 6,
        "changes": [
            "Increased donors_per_round from 5 → 7",
            "Reduced escalation window 6h → 4h",
            f"Added secondary channel for {blood_group}"
        ],
        "recommended_protocol": {
            "version": new_version,
            "donors_per_round": 7,
            "escalation_hours": 4,
        }
    }
    _failure_log.append(entry)
    return {"message": f"Failure logged. Protocol updated to v{new_version}.", "entry": entry}


@router.post("/requests/{request_id}/confirm-appointment")
def confirm_appointment(request_id: int, db: Session = Depends(get_db)):
    """Promote a 'responded' match to 'appointed' and set schedule. Used when donor said YES but pairing wasn't recorded."""
    from app.database import MatchResult
    match = db.query(MatchResult).filter(
        MatchResult.request_id == request_id,
        MatchResult.status.in_(["responded", "assigned"])
    ).order_by(MatchResult.rank).first()
    if not match:
        raise HTTPException(404, "No responded/assigned match found for this request")
    donor = match.donor
    req = match.blood_request
    time_period = (donor.preferred_time_period or "Morning").capitalize()
    slots = {
        "Morning": "09:00 AM - 12:00 PM",
        "Afternoon": "12:00 PM - 04:00 PM",
        "Evening": "04:00 PM - 08:00 PM",
        "Night": "08:00 PM - 10:00 PM"
    }
    slot_time = slots.get(time_period, "09:00 AM - 12:00 PM")
    req_date = req.required_date if req else None
    if not req_date:
        req_date = date.today() + timedelta(days=3)
    match.status = "appointed"
    match.scheduled_time = slot_time
    match.donation_date = req_date
    if req:
        req.status = "Donor Confirmed"
    if donor:
        donor.availability_status = "unavailable"
    from app.database import OutreachHistory
    db.add(OutreachHistory(
        request_id=request_id,
        round=req.escalation_round or 1 if req else 1,
        action="appointment_confirmed",
        details=f"Donor {donor.name} manually confirmed as appointed. Slot: {slot_time} on {req_date}"
    ))
    db.commit()
    db.refresh(match)
    return {
        "status": "appointed",
        "donor_name": donor.name,
        "scheduled_time": slot_time,
        "donation_date": str(req_date)
    }


@router.post("/requests/{request_id}/remind")
def send_pre_donation_reminder(request_id: int, db: Session = Depends(get_db)):
    from app.database import Notification, MatchResult, OutreachHistory
    match = db.query(MatchResult).filter(
        MatchResult.request_id == request_id,
        MatchResult.status == "appointed"
    ).first()
    
    if not match:
        raise HTTPException(404, "No appointed donor found for this request")
        
    donor = match.donor
    req = match.blood_request
    
    reminder = db.query(Notification).filter(
        Notification.request_id == request_id,
        Notification.donor_id == donor.id,
        Notification.status == "scheduled_reminder"
    ).first()
    
    if reminder:
        reminder.status = "sent"
        reminder.sent_at = datetime.utcnow()
    else:
        slot_time = match.scheduled_time or "09:00 AM - 12:00 PM"
        req_date = match.donation_date or (date.today() + timedelta(days=1))
        reminder_msg = f"[Blood Warriors] Pre-Donation Reminder: Hello {donor.name}, you are scheduled to donate {req.blood_group} blood for {req.patient.name} tomorrow ({req_date}) at {slot_time} at {req.patient.hospital}. Please reply YES to confirm availability."
        reminder = Notification(
            request_id=request_id,
            donor_id=donor.id,
            channel=donor.preferred_channel,
            message=reminder_msg,
            status="sent",
            sent_at=datetime.utcnow()
        )
        db.add(reminder)
        
    db.add(OutreachHistory(
        request_id=request_id,
        round=req.escalation_round or 1,
        action="pre_donation_reminder",
        details=f"Sent pre-donation reminder to donor {donor.name} via {donor.preferred_channel}"
    ))
    db.commit()
    db.refresh(reminder)
    return {"status": "sent", "notification_id": reminder.id, "message": reminder.message}


# (appointments endpoint now at top of patient routes to avoid param conflict)


# ─── Auto-Pipeline Endpoints ─────────────────────────────────────────────────

@router.get("/pipeline/status")
def pipeline_status():
    """Get current auto-pipeline state and last run results."""
    return get_pipeline_status()


@router.post("/pipeline/run")
def trigger_pipeline():
    """Manually trigger a full pipeline run (same as auto, but on demand)."""
    result = run_pipeline_once()
    return {"status": "completed", "result": result}


@router.post("/pipeline/start")
def start_pipeline():
    start_pipeline_scheduler()
    return {"status": "started", "interval_seconds": 300}


@router.post("/pipeline/stop")
def stop_pipeline():
    stop_pipeline_scheduler()
    return {"status": "stopped"}


# ─── Donor History & Smart Stats ─────────────────────────────────────────────

@router.get("/donors/{donor_id}/history")
def get_donor_history(donor_id: int, db: Session = Depends(get_db)):
    from app.database import DonorHistory
    donor = db.query(Donor).filter(Donor.id == donor_id).first()
    if not donor:
        raise HTTPException(404, "Donor not found")

    history = db.query(DonorHistory).filter(
        DonorHistory.donor_id == donor_id
    ).order_by(DonorHistory.donation_date.desc()).all()

    try:
        import json
        pattern = json.loads(donor.availability_pattern or "{}")
    except Exception:
        pattern = {}

    return {
        "donor_id": donor.id,
        "donor_name": donor.name,
        "blood_group": donor.blood_group,
        "total_donations_completed": donor.total_donations_completed or 0,
        "donation_count": donor.donation_count or 0,
        "last_donation_date": str(donor.last_donation_date) if donor.last_donation_date else None,
        "next_eligible_date": str(donor.next_eligible_date) if donor.next_eligible_date else None,
        "avg_response_hours": donor.avg_response_hours or 12.0,
        "availability_pattern": pattern,
        "response_rate": donor.response_rate or 0.5,
        "history": [
            {
                "id": h.id,
                "patient_name": h.patient_name,
                "blood_group": h.blood_group,
                "hospital": h.hospital,
                "city": h.city,
                "donation_date": str(h.donation_date) if h.donation_date else "",
                "time_slot": h.time_slot,
                "response_time_hours": h.response_time_hours,
                "auto_confirmed": h.auto_confirmed,
            }
            for h in history
        ]
    }


@router.post("/requests/{request_id}/complete-donation")
def complete_donation(request_id: int, db: Session = Depends(get_db)):
    """Mark donation as completed, record history, update donor stats and eligibility."""
    record_completed_donation(db, request_id)
    req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if req:
        req.status = "Completed"
        db.commit()
    return {"status": "completed", "message": "Donation recorded. Donor stats updated. 90-day cooldown started."}


# ─── AWS Integrations (Bedrock, DynamoDB, Kinesis) ───────────────────────────

class BedrockChatRequest(BaseModel):
    donor_id: int
    message: str
    blood_group: str = "A+"
    hospital: str = "Apollo Hospital"
    language: str = "English"


class UrgencyAnalysisRequest(BaseModel):
    disease: str
    last_transfusion_days_ago: int
    avg_gap_days: int
    days_until_need: int


@router.get("/aws/status")
def aws_status():
    """Get status of Bedrock, DynamoDB, Kinesis, and Step Functions services."""
    return {
        "bedrock": get_bedrock_status(),
        "dynamodb": get_dynamodb_status(),
        "kinesis": get_kinesis_status(),
        "stepfunctions": get_step_functions_status(),
    }


@router.get("/aws/kinesis/events")
def get_kinesis_events(limit: int = 50, event_type: str | None = None):
    """Retrieve recent published events from the Kinesis stream (local fallback log)."""
    return {"events": get_recent_events(limit=limit, event_type=event_type)}


@router.get("/aws/dynamodb/runs")
def get_dynamodb_runs(limit: int = 20):
    """Retrieve recent pipeline execution runs from DynamoDB cache."""
    return {"runs": get_pipeline_run_history(limit=limit)}


@router.get("/aws/dynamodb/conversations/{donor_id}")
def get_dynamodb_conversation(donor_id: int):
    """Retrieve chat session history for a specific donor from DynamoDB cache."""
    return {"history": get_conversation_history(donor_id)}


@router.post("/aws/bedrock/chat")
def simulate_bedrock_chat(body: BedrockChatRequest):
    """Simulate a donor replying to Bedrock, letting Bedrock analyze the response & follow up."""
    from app.services.dynamodb_service import add_conversation_turn
    
    # Store donor message
    add_conversation_turn(body.donor_id, "user", body.message)
    
    # Process with Bedrock
    result = handle_donor_conversation(
        donor_name=f"Donor #{body.donor_id}",
        donor_response_text=body.message,
        blood_group=body.blood_group,
        hospital=body.hospital,
        scheduled_time="Evening",
        language=body.language
    )
    
    # Store AI response
    add_conversation_turn(body.donor_id, "assistant", result["follow_up_message"])
    
    # Publish DonorResponded event to Kinesis
    from app.services.kinesis_service import event_donor_responded
    event_donor_responded(
        request_id=0,  # Simulated
        donor_id=body.donor_id,
        donor_name=f"Donor #{body.donor_id}",
        response=result["normalized_response"],
        response_time_hours=1.5
    )
    
    return result


@router.post("/aws/bedrock/analyze-urgency")
def analyze_urgency(body: UrgencyAnalysisRequest):
    """Call Bedrock to perform medical NLP urgency analysis for a thalassemia patient."""
    return analyze_patient_urgency(
        disease=body.disease,
        last_transfusion_days_ago=body.last_transfusion_days_ago,
        avg_gap_days=body.avg_gap_days,
        days_until_need=body.days_until_need
    )


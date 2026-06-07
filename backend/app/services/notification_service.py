from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.config import settings
from app.database import BloodRequest, Donor, MatchResult, Notification, OutreachHistory
from app.services.message_service import generate_ai_message, save_conversation
from app.services.matching_service import match_donors_for_request

ESCALATION_HOURS = getattr(settings, "outreach_escalation_hours", 6)
MAX_ROUNDS = 3

TONE_TEMPLATES = {
    "English": {
        "normal": "[Blood Warriors] Dear {name}, a Thalassemia patient in {city} needs {blood_group} blood at {hospital}. Can you donate? Reply YES to confirm.",
        "high": "[Blood Warriors] URGENT: {name}, a patient needs {blood_group} blood within 48 hours at {hospital}, {city}. Your help is critical. Reply YES if available.",
        "critical": "[Blood Warriors] CRITICAL ALERT: {name}, emergency need for {blood_group} at {hospital}. No donors confirmed yet. Please respond immediately.",
    },
    "Hindi": {
        "normal": "[Blood Warriors] प्रिय {name}, {city} में थैलेसीमिया रोगी को {blood_group} रक्त चाहिए ({hospital})। YES भेजें यदि उपलब्ध हों।",
        "high": "[Blood Warriors] जरूरी: {name}, 48 घंटे में {blood_group} रक्त चाहिए — {hospital}, {city}। YES भेजें।",
        "critical": "[Blood Warriors] आपातकाल: {name}, {hospital} में {blood_group} की तत्काल आवश्यकता। तुरंत जवाब दें।",
    },
    "Telugu": {
        "normal": "[Blood Warriors] ప్రియ {name}, {city} లో Thalassemia patient కు {blood_group} రక్తం అవసరం ({hospital}). అవును అని reply చేయండి.",
        "high": "[Blood Warriors] అత్యవసరం: {name}, 48 గంటల్లో {blood_group} అవసరం — {hospital}, {city}.",
        "critical": "[Blood Warriors] క్రిటికల్: {name}, {hospital} లో {blood_group} తక్షణ అవసరం.",
    },
}


def _generate_message(donor: Donor, req: BloodRequest, urgency: str, db: Session) -> str:
    result = generate_ai_message(db, donor.id, req.id)
    return result["formats"].get(donor.preferred_channel, result["message"])


def _format_for_channel(message: str, channel: str) -> str:
    if channel == "SMS":
        return message[:160]
    if channel == "Email":
        return f"Subject: Blood Donation Request - Blood Warriors\n\n{message}\n\n-- Blood Warriors Foundation"
    if channel == "WhatsApp":
        return f"*{message.split(']')[0]}]*{message.split(']', 1)[-1]}"
    return message


def send_outreach_for_request(db: Session, request_id: int, round_num: int = 1) -> list[Notification]:
    req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not req:
        raise ValueError("Request not found")

    matches = (
        db.query(MatchResult)
        .filter(MatchResult.request_id == request_id, MatchResult.outreach_round == round_num)
        .order_by(MatchResult.rank)
        .limit(5)
        .all()
    )

    if not matches:
        matches = match_donors_for_request(db, request_id, top_n=5, round_num=round_num)

    urgency = req.urgency if req.status != "Critical" else "critical"
    if req.status == "Critical":
        urgency = "critical"

    notifications = []
    for m in matches:
        donor = db.query(Donor).filter(Donor.id == m.donor_id).first()
        if not donor:
            continue
        raw_msg = _generate_message(donor, req, urgency, db)
        msg = _format_for_channel(raw_msg, donor.preferred_channel)

        notif = Notification(
            request_id=request_id,
            donor_id=donor.id,
            channel=donor.preferred_channel,
            message=msg,
            status="pending_review",
        )
        db.add(notif)
        notifications.append(notif)

    db.add(OutreachHistory(
        request_id=request_id,
        round=round_num,
        action="outreach_sent",
        details=f"Sent {len(notifications)} notifications via AI outreach (round {round_num})",
    ))
    db.commit()
    for n in notifications:
        db.refresh(n)
    return notifications


def record_donor_response(db: Session, notification_id: int, response: str) -> Notification:
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise ValueError("Notification not found")

    notif.donor_response = response
    notif.responded_at = datetime.utcnow()
    is_yes = response.lower() in ("yes", "available", "confirmed")
    notif.status = "responded" if is_yes else "declined"

    match = (
        db.query(MatchResult)
        .filter(MatchResult.request_id == notif.request_id, MatchResult.donor_id == notif.donor_id)
        .first()
    )
    req = db.query(BloodRequest).filter(BloodRequest.id == notif.request_id).first()
    donor = notif.donor

    if is_yes:
        if req:
            req.status = "Donor Confirmed"
        if match:
            match.status = "appointed"
            
            # Scheduling based on preferred period
            time_period = (donor.preferred_time_period or "Morning").capitalize()
            slots = {
                "Morning": "09:00 AM - 12:00 PM",
                "Afternoon": "12:00 PM - 04:00 PM",
                "Evening": "04:00 PM - 08:00 PM",
                "Night": "08:00 PM - 10:00 PM"
            }
            slot_time = slots.get(time_period, "09:00 AM - 12:00 PM")
            
            # Fallback date calculation
            req_date = None
            if req:
                req_date = req.required_date
                if not req_date and req.created_at:
                    req_date = req.created_at.date() + timedelta(days=3)
            if not req_date:
                req_date = date.today() + timedelta(days=3)
                
            match.scheduled_time = slot_time
            match.donation_date = req_date
            
            # Queue pre-donation reminder for donor
            reminder_msg = f"[Blood Warriors] Pre-Donation Reminder: Hello {donor.name}, you are scheduled to donate {req.blood_group if req else donor.blood_group} blood for {req.patient.name if req and req.patient else 'your paired patient'} tomorrow ({req_date}) at {slot_time} at {req.patient.hospital if req and req.patient else 'the hospital'}. Please reply YES to confirm availability."
            reminder_notif = Notification(
                request_id=notif.request_id,
                donor_id=donor.id,
                channel=donor.preferred_channel,
                message=reminder_msg,
                status="scheduled_reminder",
                sent_at=datetime.utcnow()
            )
            db.add(reminder_notif)
            
        if donor:
            donor.availability_status = "unavailable"
            save_conversation(db, donor.id, "user", f"Confirmed donation: {response}")
    else:
        if match:
            match.status = "declined"

    db.add(OutreachHistory(
        request_id=notif.request_id,
        round=req.escalation_round if req else 1,
        action="donor_response",
        details=f"Donor {notif.donor_id} responded: {response}. Status: {'Appointed & Scheduled' if is_yes else 'Declined'}",
    ))
    db.commit()
    db.refresh(notif)
    return notif


def check_escalation(db: Session, request_id: int) -> dict:
    req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not req:
        raise ValueError("Request not found")

    if req.status in ("Completed", "Fulfilled", "Cancelled"):
        return {"escalated": False, "status": req.status}

    cutoff = datetime.utcnow() - timedelta(hours=ESCALATION_HOURS)
    recent_notifs = (
        db.query(Notification)
        .filter(Notification.request_id == request_id, Notification.sent_at >= cutoff)
        .all()
    )

    if not recent_notifs:
        return {"escalated": False, "message": "No recent notifications"}

    responses = [n for n in recent_notifs if n.status == "responded" and n.donor_response and n.donor_response.lower() in ("yes", "available", "confirmed")]
    if responses:
        return {"escalated": False, "message": "Donor confirmed"}

    current_round = req.escalation_round or 1
    if current_round >= MAX_ROUNDS:
        req.status = "Critical"
        db.add(OutreachHistory(
            request_id=request_id,
            round=current_round,
            action="escalated_critical",
            details="No donor confirmed after max outreach rounds",
        ))
        db.commit()
        return {"escalated": True, "status": "Critical", "round": current_round}

    next_round = current_round + 1
    new_matches = match_donors_for_request(db, request_id, top_n=5, round_num=next_round)
    new_notifs = send_outreach_for_request(db, request_id, round_num=next_round)

    db.add(OutreachHistory(
        request_id=request_id,
        round=next_round,
        action="escalation_round",
        details=f"Escalated to round {next_round}, contacted {len(new_notifs)} new donors",
    ))
    db.commit()

    return {
        "escalated": True,
        "status": req.status,
        "round": next_round,
        "new_donors_contacted": len(new_notifs),
    }


def get_request_outreach_status(db: Session, request_id: int) -> dict:
    req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not req:
        raise ValueError("Request not found")

    notifs = db.query(Notification).filter(Notification.request_id == request_id).order_by(Notification.sent_at.desc()).all()
    history = db.query(OutreachHistory).filter(OutreachHistory.request_id == request_id).order_by(OutreachHistory.created_at.desc()).all()
    matches = db.query(MatchResult).filter(MatchResult.request_id == request_id).count()

    appointed_match = db.query(MatchResult).filter(
        MatchResult.request_id == request_id,
        MatchResult.status == "appointed"
    ).first()
    appointment = None
    if appointed_match:
        appointment = {
            "donor_name": appointed_match.donor.name if appointed_match.donor else "Unknown",
            "donor_contact": appointed_match.donor.contact if appointed_match.donor else "",
            "scheduled_time": appointed_match.scheduled_time or "",
            "donation_date": str(appointed_match.donation_date) if appointed_match.donation_date else "",
        }

    return {
        "request_id": request_id,
        "status": req.status,
        "urgency": req.urgency,
        "escalation_round": req.escalation_round,
        "total_matches": matches,
        "appointment": appointment,
        "notifications": [
            {
                "id": n.id,
                "donor_id": n.donor_id,
                "donor_name": n.donor.name if n.donor else "",
                "channel": n.channel,
                "message": n.message,
                "status": n.status,
                "donor_response": n.donor_response,
                "sent_at": n.sent_at.isoformat() if n.sent_at else None,
            }
            for n in notifs
        ],
        "history": [
            {
                "round": h.round,
                "action": h.action,
                "details": h.details,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            }
            for h in history
        ],
    }


def approve_outreach(db: Session, request_id: int) -> dict:
    req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not req:
        raise ValueError("Request not found")
    pending = db.query(Notification).filter(
        Notification.request_id == request_id,
        Notification.status == "pending_review",
    ).all()
    for n in pending:
        n.status = "sent"
    db.add(OutreachHistory(
        request_id=request_id,
        round=req.escalation_round or 1,
        action="coordinator_approved",
        details=f"Coordinator approved {len(pending)} outreach messages",
    ))
    db.commit()
    return {"approved": len(pending), "request_id": request_id}


def complete_request(db: Session, request_id: int) -> BloodRequest:
    req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not req:
        raise ValueError("Request not found")
    req.status = "Completed"
    
    # Update patient's last transfusion date to reset the cycle
    if req.patient:
        # Check if there is an appointed match to get the donation date
        match = db.query(MatchResult).filter(
            MatchResult.request_id == request_id,
            MatchResult.status == "appointed"
        ).first()
        req.patient.last_transfusion_date = (match.donation_date if match else date.today()) or date.today()

    db.add(OutreachHistory(
        request_id=request_id,
        round=req.escalation_round or 1,
        action="donation_completed",
        details="Coordinator marked donation as completed",
    ))
    db.commit()
    db.refresh(req)
    return req

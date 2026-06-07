from __future__ import annotations

from sqlalchemy.orm import Session

from app.database import BloodRequest, Conversation, Donor
from app.services.bedrock_service import generate_outreach_message, handle_donor_conversation, get_bedrock_status
from app.services.dynamodb_service import add_conversation_turn, get_conversation_history


def _time_label(donor: Donor) -> str:
    if donor.preferred_time_period:
        return donor.preferred_time_period
    h = donor.preferred_contact_hour
    if h < 12:
        return "Morning"
    if h < 17:
        return "Afternoon"
    return "Evening"


def _blood_short(bg: str) -> str:
    return bg.replace(" Positive", "+").replace(" Negative", "-")


def generate_ai_message(
    db: Session,
    donor_id: int,
    request_id: int | None = None,
    blood_group: str | None = None,
    city: str = "Hyderabad",
    hospital: str = "Apollo Hospital",
    urgency: str = "normal",
) -> dict:
    donor = db.query(Donor).filter(Donor.id == donor_id).first()
    if not donor:
        raise ValueError("Donor not found")

    if request_id:
        req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
        if req:
            blood_group = req.blood_group
            patient = req.patient
            city = patient.city if patient else city
            hospital = patient.hospital if patient else hospital
            urgency = req.urgency if req.status != "Critical" else "critical"

    disease = "Thalassemia"
    if request_id:
        req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
        if req:
            blood_group = req.blood_group
            patient = req.patient
            city = patient.city if patient else city
            hospital = patient.hospital if patient else hospital
            urgency = req.urgency if req.status != "Critical" else "critical"
            disease = (patient.medical_notes or "Thalassemia") if patient else "Thalassemia"

    blood_group = blood_group or donor.blood_group
    time_pref = _time_label(donor)
    lang = donor.preferred_language
    channel = donor.preferred_channel

    # ── Amazon Bedrock Generation ──────────────────────────────────────────────
    result = generate_outreach_message(
        donor_name=donor.name,
        blood_group=blood_group,
        city=city,
        hospital=hospital,
        disease=disease,
        language=lang,
        channel=channel,
        time_period=time_pref,
        urgency=urgency,
        use_bedrock=True,
    )
    message = result["message"]
    ai_source = result["source"]

    # Format variants for different channels
    sms = message.replace("\n\n", " ").replace("\n", " ")[:160]
    email = f"Subject: Blood Donation Request — Blood Warriors\n\n{message}\n\nPreferred contact time: {time_pref}\nReply YES to confirm.\n\n-- Blood Warriors Foundation"
    whatsapp = message if channel == "WhatsApp" else f"*Blood Warriors*\n\n{message}\n\n_Preferred: {lang} · {time_pref} · via WhatsApp_"

    memory_note = f"[{ai_source.upper()}] Uses preferences: {lang}, {time_pref}, {channel}"

    # Store in DynamoDB conversation history
    add_conversation_turn(donor.id, "assistant", message)

    return {
        "donor_id": donor.id,
        "donor_name": donor.name,
        "request_id": request_id,
        "blood_group": blood_group,
        "preferred_language": lang,
        "preferred_time": time_pref,
        "preferred_channel": channel,
        "memory_note": memory_note,
        "message": message,
        "ai_source": ai_source,
        "bedrock_available": get_bedrock_status()["available"],
        "formats": {
            "SMS": sms,
            "Email": email,
            "WhatsApp": whatsapp,
        },
        "ai_provider": f"Amazon Bedrock (Claude claude-3-haiku)" if ai_source.startswith("bedrock") else "Template Engine",
    }


def save_conversation(db: Session, donor_id: int, role: str, content: str) -> None:
    db.add(Conversation(donor_id=donor_id, role=role, content=content))
    db.commit()


def get_donor_memory(db: Session, donor_id: int) -> dict:
    donor = db.query(Donor).filter(Donor.id == donor_id).first()
    if not donor:
        return {}
    convos = (
        db.query(Conversation)
        .filter(Conversation.donor_id == donor_id)
        .order_by(Conversation.created_at.desc())
        .limit(5)
        .all()
    )
    return {
        "donor_id": donor_id,
        "donor_name": donor.name,
        "preferred_language": donor.preferred_language,
        "preferred_time": _time_label(donor),
        "preferred_channel": donor.preferred_channel,
        "recent_messages": [{"role": c.role, "content": c.content} for c in convos],
    }

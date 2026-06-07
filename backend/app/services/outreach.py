from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from app.services.data_loader import donor_profile


TONE_TEMPLATES = {
    "formal": {
        "English": "Dear donor, Blood Warriors requires {blood_group} blood for a Thalassemia patient in {city}. Your support can save a life. Reply YES to confirm availability.",
        "Hindi": "प्रिय रक्तदाता, Blood Warriors को {city} में थैलेसीमिया रोगी के लिए {blood_group} रक्त की आवश्यकता है। कृपया YES भेजकर उपलब्धता बताएं।",
        "Telugu": "ప్రియమైన రక్తదాత, Blood Warriors కు {city} లో తలసsemia రోగికి {blood_group} రక్తం అవసరం. YES అని స్పందించండి.",
    },
    "casual": {
        "English": "Hey! Blood Warriors here 👋 A patient needs {blood_group} in {city}. Can you help this week? Just reply YES!",
        "Hindi": "नमस्ते! Blood Warriors से — {city} में patient को {blood_group} चाहिए। इस हफ्ते donate कर सकते हो? YES भेजो!",
        "Telugu": "హాయ్! Blood Warriors — {city} లో patient కు {blood_group} కావాలి. ఈ వారం donate చేయగలరా? YES అని reply చేయండి!",
    },
    "medical_urgency": {
        "English": "URGENT — Blood Warriors: A Thalassemia patient requires {blood_group} transfusion in {city}. Time-sensitive need. Please respond if available.",
        "Hindi": "जरूरी — Blood Warriors: {city} में Thalassemia patient को {blood_group} transfusion चाहिए। कृपया तुरंत जवाब दें।",
        "Telugu": "అత్యవసరం — Blood Warriors: {city} లో Thalassemia patient కు {blood_group} transfusion అవసరం. దయచేసి respond చేయండి.",
    },
    "personal_story": {
        "English": "Blood Warriors — 12-year-old Arjun in {city} needs {blood_group} for his monthly transfusion. Your past donations have helped families like his. Can you step up again?",
        "Hindi": "Blood Warriors — {city} के 12 साल के Arjun को monthly transfusion के लिए {blood_group} चाहिए। आपका support बदलाव लाता है। फिर मदद करेंगे?",
        "Telugu": "Blood Warriors — {city} లో 12 సంవత్సరాల Arjun కు monthly transfusion కోసం {blood_group} అవసరం. మీరు మళ్లీ సహాయం చేయగలరా?",
    },
}


def generate_outreach(donor_id: str, blood_group: str, bridge_id: str | None = None, city: str = "Hyderabad") -> dict[str, Any]:
    profile = donor_profile(donor_id)
    if not profile:
        return {"error": "Donor not found"}

    tone = profile["preferred_tone"]
    lang = profile["preferred_language"]
    channel = profile["preferred_channel"]
    hour = profile["best_contact_hour"]

    templates = TONE_TEMPLATES.get(tone, TONE_TEMPLATES["formal"])
    template = templates.get(lang, templates["English"])
    message = template.format(blood_group=blood_group, city=city)
    message = f"[Blood Warriors] {message}"

    now = datetime.now()
    scheduled = now.replace(hour=hour, minute=0, second=0, microsecond=0)
    if scheduled < now:
        scheduled += timedelta(days=1)

    return {
        "donor_id": donor_id,
        "channel": channel,
        "language": lang,
        "tone": tone,
        "message": message,
        "scheduled_at": scheduled.isoformat(),
        "bridge_id": bridge_id,
    }


def run_outreach_campaign(
    blood_group: str,
    donor_ids: list[str],
    bridge_id: str | None = None,
) -> list[dict[str, Any]]:
    return [generate_outreach(did, blood_group, bridge_id) for did in donor_ids]

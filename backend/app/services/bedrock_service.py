"""
Amazon Bedrock AI Service — Layer 3 (Intelligence Layer)
=========================================================
Uses Claude claude-3-haiku-20240307 via Amazon Bedrock for:
- Multilingual donor outreach message generation
- Medical NLP for patient condition analysis
- Conversational donor AI (YES/NO follow-up)
- Smart ranking explanations

Falls back to template-based generation when boto3/Bedrock is unavailable
(local development without AWS credentials).
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Bedrock Client (lazy-initialized) ───────────────────────────────────────

_bedrock_client = None
BEDROCK_AVAILABLE = False


def _get_bedrock_client():
    global _bedrock_client, BEDROCK_AVAILABLE
    if _bedrock_client is not None:
        return _bedrock_client
    try:
        import boto3
        session = boto3.Session()
        credentials = session.get_credentials()
        if not credentials:
            raise ValueError("No AWS credentials found in local environment")
            
        region = os.environ.get("AWS_REGION", "ap-south-1")
        _bedrock_client = boto3.client(
            service_name="bedrock-runtime",
            region_name=region,
        )
        # Quick health check
        BEDROCK_AVAILABLE = True
        logger.info("✅ Amazon Bedrock client initialized (region: %s)", region)
    except Exception as e:
        logger.warning("⚠️  Bedrock unavailable — using template fallback: %s", e)
        BEDROCK_AVAILABLE = False
        _bedrock_client = None
    return _bedrock_client



def _invoke_claude(prompt: str, max_tokens: int = 512, temperature: float = 0.7) -> str:
    """Invoke Claude claude-3-haiku via Bedrock. Returns generated text."""
    global BEDROCK_AVAILABLE
    if not BEDROCK_AVAILABLE:
        return ""
        
    client = _get_bedrock_client()
    if not client:
        return ""

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    })

    try:
        response = client.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        result = json.loads(response["body"].read())
        return result["content"][0]["text"].strip()
    except Exception as e:
        logger.error("Bedrock invocation failed: %s", e)
        if "credential" in str(e).lower() or "auth" in str(e).lower():
            BEDROCK_AVAILABLE = False
        return ""



# ─── Language Templates (fallback when Bedrock unavailable) ──────────────────

LANGUAGE_TEMPLATES = {
    "Telugu": {
        "WhatsApp": (
            "నమస్కారం {donor_name},\n\n"
            "{city} లో {disease} వ్యాధితో బాధపడుతున్న రోగికి {blood_group} రక్తం అత్యవసరంగా కావాలి "
            "({hospital} లో).\n"
            "మీరు రక్తదానం చేయగలరా?\n\n"
            "🩸 Blood Warriors"
        ),
        "SMS": (
            "నమస్కారం {donor_name}, {city} లో {disease} రోగికి {blood_group} రక్తం కావాలి "
            "({hospital}). సహాయం చేయగలరా? 🩸 Blood Warriors"
        ),
        "Email": (
            "Subject: రక్తదాన అభ్యర్థన - Blood Warriors\n\n"
            "నమస్కారం {donor_name},\n\n"
            "{city} లో {disease} వ్యాధితో బాధపడుతున్న రోగికి {blood_group} రక్తం అత్యవసరంగా "
            "కావాలి ({hospital}).\n"
            "మీ సమయం: {time_period}\n"
            "సహాయం చేయండి? YES అని reply చేయండి.\n\n"
            "🩸 Blood Warriors Foundation"
        ),
    },
    "Hindi": {
        "WhatsApp": (
            "नमस्ते {donor_name},\n\n"
            "{city} में {disease} से पीड़ित मरीज को {blood_group} रक्त की तत्काल जरूरत है "
            "({hospital} में)।\n"
            "क्या आप रक्तदान कर सकते हैं?\n\n"
            "🩸 Blood Warriors"
        ),
        "SMS": (
            "नमस्ते {donor_name}, {city} में {disease} मरीज को {blood_group} रक्त चाहिए "
            "({hospital}). मदद करें? 🩸 Blood Warriors"
        ),
        "Email": (
            "Subject: रक्तदान अनुरोध - Blood Warriors\n\n"
            "नमस्ते {donor_name},\n\n"
            "{city} में एक मरीज को तत्काल {blood_group} रक्त की आवश्यकता है ({hospital})।\n"
            "पसंदीदा समय: {time_period}\n"
            "YES भेजकर सहयोग करें।\n\n"
            "🩸 Blood Warriors Foundation"
        ),
    },
    "Tamil": {
        "WhatsApp": (
            "வணக்கம் {donor_name},\n\n"
            "{city} இல் {disease} நோயாளிக்கு {blood_group} ரத்தம் அவசரமாக தேவை "
            "({hospital}).\n"
            "இரத்தம் தானம் செய்ய முடியுமா?\n\n"
            "🩸 Blood Warriors"
        ),
        "SMS": (
            "வணக்கம் {donor_name}, {city} நோயாளிக்கு {blood_group} ரத்தம் தேவை ({hospital}). "
            "உதவுவீர்களா? 🩸"
        ),
        "Email": (
            "Subject: இரத்த தானம் கோரிக்கை - Blood Warriors\n\n"
            "வணக்கம் {donor_name},\n\n"
            "{city} இல் {blood_group} ரத்தம் அவசரமாக தேவை ({hospital}).\n"
            "YES என்று பதில் அனுப்பவும்.\n\n🩸 Blood Warriors"
        ),
    },
    "Kannada": {
        "WhatsApp": (
            "ನಮಸ್ಕಾರ {donor_name},\n\n"
            "{city} ನಲ್ಲಿ {disease} ರೋಗಿಗೆ {blood_group} ರಕ್ತ ತುರ್ತಾಗಿ ಬೇಕಿದೆ ({hospital}).\n"
            "ರಕ್ತದಾನ ಮಾಡಲು ಸಾಧ್ಯವೇ?\n\n🩸 Blood Warriors"
        ),
        "SMS": (
            "ನಮಸ್ಕಾರ {donor_name}, {city} ರೋಗಿಗೆ {blood_group} ರಕ್ತ ಬೇಕು ({hospital}). "
            "ಸಹಾಯ ಮಾಡಿ? 🩸"
        ),
        "Email": (
            "Subject: ರಕ್ತದಾನ ವಿನಂತಿ - Blood Warriors\n\n"
            "ನಮಸ್ಕಾರ {donor_name},\n{city} ರೋಗಿಗೆ {blood_group} ರಕ್ತ ತುರ್ತಾಗಿ ಬೇಕು ({hospital}).\n"
            "YES ಎಂದು reply ಮಾಡಿ.\n\n🩸 Blood Warriors"
        ),
    },
    "English": {
        "WhatsApp": (
            "*Blood Warriors*\n\n"
            "Hello {donor_name},\n\n"
            "A patient in {city} urgently requires {blood_group} blood at {hospital}.\n"
            "Condition: {disease}\n"
            "Would you be available to donate?\n\n"
            "🩸 Blood Warriors\n_Preferred: {language} · {time_period} · via WhatsApp_"
        ),
        "SMS": (
            "[Blood Warriors] Hello {donor_name}, patient in {city} needs {blood_group} blood "
            "at {hospital}. Can you donate? Reply YES. 🩸"
        ),
        "Email": (
            "Subject: Blood Donation Request — Blood Warriors\n\n"
            "Dear {donor_name},\n\n"
            "A patient in {city} urgently requires {blood_group} blood at {hospital}.\n"
            "Condition: {disease}\n"
            "Preferred contact time: {time_period}\n"
            "Reply YES to confirm.\n\n"
            "-- Blood Warriors Foundation"
        ),
    },
}


# ─── Core Generation Functions ────────────────────────────────────────────────

def generate_outreach_message(
    donor_name: str,
    blood_group: str,
    city: str,
    hospital: str,
    disease: str,
    language: str,
    channel: str,
    time_period: str,
    urgency: str = "high",
    days_until: int = 3,
    use_bedrock: bool = True,
) -> dict:
    """
    Generate a personalized donor outreach message.
    
    Uses Bedrock Claude when available, falls back to curated templates.
    Returns: { message, source, language, channel }
    """
    context = {
        "donor_name": donor_name,
        "blood_group": blood_group,
        "city": city,
        "hospital": hospital,
        "disease": disease,
        "language": language,
        "channel": channel,
        "time_period": time_period,
    }

    # Try Bedrock first
    if use_bedrock:
        bedrock_msg = _generate_with_bedrock(
            donor_name=donor_name,
            blood_group=blood_group,
            city=city,
            hospital=hospital,
            disease=disease,
            language=language,
            channel=channel,
            time_period=time_period,
            urgency=urgency,
            days_until=days_until,
        )
        if bedrock_msg:
            return {
                "message": bedrock_msg,
                "source": "bedrock-claude-haiku",
                "language": language,
                "channel": channel,
            }

    # Fallback to curated templates
    lang_templates = LANGUAGE_TEMPLATES.get(language, LANGUAGE_TEMPLATES["English"])
    channel_template = lang_templates.get(channel, lang_templates.get("WhatsApp", ""))
    message = channel_template.format(**context)

    return {
        "message": message,
        "source": "template",
        "language": language,
        "channel": channel,
    }


def _generate_with_bedrock(
    donor_name: str,
    blood_group: str,
    city: str,
    hospital: str,
    disease: str,
    language: str,
    channel: str,
    time_period: str,
    urgency: str,
    days_until: int,
) -> str:
    """Call Claude to generate a personalized outreach message."""
    urgency_text = "CRITICAL — needed TODAY" if days_until <= 1 else f"needed in {days_until} days"
    channel_style = {
        "WhatsApp": "WhatsApp message (use bold *text*, emojis, keep under 200 words)",
        "SMS": "SMS (max 160 chars, plain text only, be very concise)",
        "Email": "email (include Subject line, professional tone, 150-200 words)",
    }.get(channel, "WhatsApp message")

    prompt = f"""You are Blood Warriors, an AI blood donation coordinator in India.

Generate a {channel_style} in {language} language to request blood donation from a donor.

Details:
- Donor name: {donor_name}
- Blood type needed: {blood_group}
- Patient location: {city}
- Hospital: {hospital}  
- Patient condition: {disease}
- Urgency: {urgency_text}
- Donor preferred time: {time_period}

Requirements:
1. Write ONLY in {language} (use native script if not English)
2. Be compassionate, urgent but not panicking
3. Mention the specific blood group and hospital name
4. End with "🩸 Blood Warriors" branding
5. Do NOT include any explanation — output only the message itself

Generate the message now:"""

    return _invoke_claude(prompt, max_tokens=300, temperature=0.6)


def analyze_patient_urgency(
    disease: str,
    last_transfusion_days_ago: int,
    avg_gap_days: int,
    days_until_need: int,
) -> dict:
    """
    Use Bedrock to analyze patient condition and return AI urgency assessment.
    Returns: { urgency_level, reasoning, recommended_action, risk_score }
    """
    prompt = f"""You are a medical AI assistant for a blood bank coordination system.

Analyze this thalassemia patient's blood need urgency:
- Condition: {disease}
- Last transfusion: {last_transfusion_days_ago} days ago
- Average gap between transfusions: {avg_gap_days} days
- Predicted days until next need: {days_until_need}

Respond ONLY with a JSON object (no markdown, no explanation):
{{
  "urgency_level": "critical|high|normal|low",
  "risk_score": 0.0-1.0,
  "reasoning": "one sentence",
  "recommended_action": "immediate|within_24h|within_3_days|routine"
}}"""

    text = _invoke_claude(prompt, max_tokens=150, temperature=0.1)

    # Parse JSON response
    try:
        # Find JSON in response
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except Exception:
        pass

    # Fallback
    if days_until_need <= 1:
        return {"urgency_level": "critical", "risk_score": 0.95, "reasoning": "Immediate need", "recommended_action": "immediate"}
    elif days_until_need <= 3:
        return {"urgency_level": "high", "risk_score": 0.75, "reasoning": "Need within 3 days", "recommended_action": "within_24h"}
    else:
        return {"urgency_level": "normal", "risk_score": 0.4, "reasoning": "Routine schedule", "recommended_action": "within_3_days"}


def generate_donor_ranking_explanation(
    donor_name: str,
    rank: int,
    score: float,
    reasons: list[str],
    blood_group: str,
    distance_km: float,
    response_rate: float,
    donation_count: int,
    language: str = "English",
) -> str:
    """
    Use Bedrock to generate a human-readable explanation of why this donor was ranked #N.
    """
    prompt = f"""You are Blood Warriors AI. Explain in 1-2 sentences why this donor was ranked #{rank}
for a blood donation request. Be specific about the key factors.

Donor: {donor_name}, Blood: {blood_group}, Score: {score}/100
Distance: {distance_km}km, Response rate: {response_rate*100:.0f}%, Donations: {donation_count}
Key factors: {', '.join(reasons)}

Write in {language}. Output only the explanation, no labels or markdown."""

    text = _invoke_claude(prompt, max_tokens=100, temperature=0.5)
    if text:
        return text

    # Fallback
    return f"Ranked #{rank} with score {score}/100 — {', '.join(reasons[:2])}."


def handle_donor_conversation(
    donor_name: str,
    donor_response_text: str,
    blood_group: str,
    hospital: str,
    scheduled_time: str,
    language: str = "English",
) -> dict:
    """
    Process a free-text donor response (beyond simple YES/NO).
    Returns: { intent, normalized_response, follow_up_message }
    """
    prompt = f"""You are Blood Warriors AI handling a blood donor response.

Donor: {donor_name}
Their message: "{donor_response_text}"
Context: They received a {blood_group} blood donation request for {hospital}

1. Determine intent: YES (will donate), NO (cannot donate), RESCHEDULE (needs different time), QUESTION (asking something), UNKNOWN
2. Generate a brief follow-up message in {language}

Respond ONLY as JSON (no markdown):
{{
  "intent": "YES|NO|RESCHEDULE|QUESTION|UNKNOWN",
  "normalized_response": "YES|NO",
  "follow_up_message": "your follow-up message here",
  "confidence": 0.0-1.0
}}"""

    text = _invoke_claude(prompt, max_tokens=200, temperature=0.2)

    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except Exception:
        pass

    # Simple rule-based fallback
    text_lower = donor_response_text.lower()
    if any(w in text_lower for w in ["yes", "sure", "ok", "haan", "avunu", "aamaala"]):
        intent = "YES"
        normalized = "YES"
        follow_up = f"Thank you {donor_name}! Your appointment will be confirmed shortly. 🩸"
    elif any(w in text_lower for w in ["no", "cant", "cannot", "sorry", "ledu", "nahi"]):
        intent = "NO"
        normalized = "NO"
        follow_up = f"Thank you for letting us know, {donor_name}. We'll reach out next time. 🙏"
    else:
        intent = "UNKNOWN"
        normalized = "NO"
        follow_up = f"Dear {donor_name}, please reply YES to confirm or NO to decline. 🩸"

    return {
        "intent": intent,
        "normalized_response": normalized,
        "follow_up_message": follow_up,
        "confidence": 0.6,
    }


def get_bedrock_status() -> dict:
    """Return current Bedrock availability status."""
    client = _get_bedrock_client()
    return {
        "available": BEDROCK_AVAILABLE,
        "model": "anthropic.claude-3-haiku-20240307-v1:0",
        "region": os.environ.get("AWS_REGION", "ap-south-1"),
        "fallback": "curated-templates" if not BEDROCK_AVAILABLE else None,
    }

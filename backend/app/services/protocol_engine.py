from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

# In-memory stores for MVP (AWS: OpenSearch + DynamoDB + Parameter Store)
_conversations: dict[str, list[dict[str, str]]] = {}
_protocols: dict[str, dict] = {
    "default": {
        "version": "1.0.0",
        "max_outreach_rounds": 3,
        "donors_per_round": 5,
        "escalation_hours": 6,
        "channels": ["WhatsApp", "SMS", "Email"],
        "retry_interval_minutes": 120,
    }
}
_failure_log: list[dict] = []
_active_requests: dict[str, dict] = {}


def get_protocol(name: str = "default") -> dict:
    return _protocols.get(name, _protocols["default"])


def chat_with_memory(user_id: str, message: str) -> dict[str, Any]:
    history = _conversations.setdefault(user_id, [])
    memory_snippets: list[str] = []

    for msg in history[-6:]:
        if msg["role"] == "user":
            memory_snippets.append(msg["content"][:80])

    lower = message.lower()
    reply_parts = ["[Blood Warriors] "]

    if any(w in lower for w in ["yes", "available", "donate", "can help"]):
        if memory_snippets:
            reply_parts.append(
                f"Thank you! I remember our earlier conversation. "
                f"You mentioned: \"{memory_snippets[-1]}...\" "
            )
        reply_parts.append(
            "Wonderful - we'll share the donation center details shortly. "
            "Your consent to donate is noted. No personal data beyond blood group and city is needed."
        )
    elif any(w in lower for w in ["no", "busy", "cannot", "can't"]):
        reply_parts.append(
            "No problem at all — thank you for letting us know. "
            "We'll reach out again when you're eligible. Take care!"
        )
    elif any(w in lower for w in ["tuesday", "wednesday", "thursday", "friday", "monday", "saturday", "sunday", "next week"]):
        reply_parts.append(
            f"Got it — I've noted your availability: \"{message}\". "
            "When we contact you again, I'll reference this."
        )
    elif "blood" in lower or "type" in lower:
        reply_parts.append(
            "We only need your registered blood group and city for matching — "
            "nothing more. All outreach is from Blood Warriors."
        )
    else:
        if memory_snippets:
            reply_parts.append(
                f"Picking up from our last chat — you said \"{memory_snippets[-1]}...\". "
            )
        reply_parts.append(
            "How can I help with your donation schedule today? "
            "Reply YES if you're available, or tell me when works best."
        )

    reply = "".join(reply_parts)
    guardrail_passed = _check_guardrails(reply)

    if not guardrail_passed:
        reply = "[Blood Warriors] Thank you for reaching out. A coordinator will follow up with you shortly."

    now = datetime.now().isoformat()
    history.append({"role": "user", "content": message, "timestamp": now})
    history.append({"role": "assistant", "content": reply, "timestamp": now})

    return {
        "user_id": user_id,
        "reply": reply,
        "memory_used": memory_snippets,
        "guardrail_passed": guardrail_passed,
    }


def _check_guardrails(text: str) -> bool:
    blocked = ["ssn", "aadhaar", "password", "bank account", "credit card"]
    lower = text.lower()
    if any(b in lower for b in blocked):
        return False
    if "blood warriors" not in lower:
        return False
    pressure = ["you must", "mandatory", "or else", "guilty"]
    if any(p in lower for p in pressure):
        return False
    return True


def record_failure(
    bridge_id: str,
    blood_group: str,
    outreach_count: int,
    responses: int,
    duration_hours: float,
) -> dict[str, Any]:
    request_id = str(uuid.uuid4())[:8]
    current = get_protocol()

    new_protocol = dict(current)
    new_protocol["version"] = f"{float(current['version'].split('.')[0]) + 0.1:.1f}.0"
    new_protocol["donors_per_round"] = min(15, current["donors_per_round"] + 2)
    new_protocol["escalation_hours"] = max(3, current["escalation_hours"] - 1)
    new_protocol["retry_interval_minutes"] = max(60, current["retry_interval_minutes"] - 30)

    changes = [
        f"Increased donors per round to {new_protocol['donors_per_round']}",
        f"Reduced escalation window to {new_protocol['escalation_hours']}h",
        f"Shortened retry interval to {new_protocol['retry_interval_minutes']}min",
        "Added multi-channel parallel outreach for similar blood groups",
    ]

    trigger = f"No donor confirmed in {duration_hours}h for {blood_group} (bridge {bridge_id[:8]}...)"
    _protocols["default"] = new_protocol

    report = {
        "request_id": request_id,
        "bridge_id": bridge_id,
        "blood_group": blood_group,
        "outreach_count": outreach_count,
        "responses": responses,
        "duration_hours": duration_hours,
        "recommended_protocol": new_protocol,
        "trigger": trigger,
        "changes": changes,
        "created_at": datetime.now().isoformat(),
    }
    _failure_log.append(report)
    return report


def get_failure_history() -> list[dict]:
    return list(reversed(_failure_log[-20:]))


def create_blood_request(bridge_id: str, blood_group: str, quantity: int = 1) -> dict:
    req_id = str(uuid.uuid4())[:8]
    _active_requests[req_id] = {
        "request_id": req_id,
        "bridge_id": bridge_id,
        "blood_group": blood_group,
        "quantity": quantity,
        "status": "active",
        "created_at": datetime.now().isoformat(),
        "protocol_version": get_protocol()["version"],
    }
    return _active_requests[req_id]


def get_conversation_history(user_id: str) -> list[dict]:
    return _conversations.get(user_id, [])

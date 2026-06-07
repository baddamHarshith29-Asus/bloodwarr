from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import numpy as np

from app.config import settings
from app.services.data_loader import (
    _parse_date,
    donor_profile,
    get_bridges_df,
    get_donors_df,
    haversine_km,
)


def _compatible_groups(required: str) -> set[str]:
    """Blood compatibility for packed RBC donation."""
    compat = {
        "O Negative": {"O Negative"},
        "O Positive": {"O Negative", "O Positive"},
        "A Negative": {"O Negative", "A Negative"},
        "A Positive": {"O Negative", "O Positive", "A Negative", "A Positive"},
        "B Negative": {"O Negative", "B Negative"},
        "B Positive": {"O Negative", "O Positive", "B Negative", "B Positive"},
        "AB Negative": {"O Negative", "A Negative", "B Negative", "AB Negative"},
        "AB Positive": {
            "O Negative", "O Positive", "A Negative", "A Positive",
            "B Negative", "B Positive", "AB Negative", "AB Positive",
        },
    }
    return compat.get(required, {required})


def predict_transfusion_cycle(bridge_id: str) -> dict[str, Any] | None:
    bridges = get_bridges_df()
    row = bridges[bridges["bridge_id"] == bridge_id]
    if row.empty:
        return None
    b = row.iloc[0]
    last = _parse_date(b.get("last_transfusion_date"))
    expected = _parse_date(b.get("expected_next_transfusion_date"))
    freq = int(b["frequency_in_days"]) if b.get("frequency_in_days") and not np.isnan(b["frequency_in_days"]) else 21
    freq = max(14, min(30, freq))

    today = date.today()
    if expected:
        predicted = expected
        confidence = 0.92
    elif last:
        predicted = last + timedelta(days=freq)
        confidence = 0.85
    else:
        predicted = today + timedelta(days=freq)
        confidence = 0.70

    days_until = (predicted - today).days
    pre_staging = 0 <= days_until <= (settings.pre_staging_hours // 24)

    return {
        "bridge_id": bridge_id,
        "bridge_blood_group": b.get("bridge_blood_group", "O Positive"),
        "last_transfusion_date": str(last) if last else None,
        "predicted_next_date": str(predicted),
        "confidence": round(confidence, 2),
        "days_until_need": days_until,
        "pre_staging_due": pre_staging,
        "frequency_days": freq,
    }


def list_predictions(within_days: int = 30) -> list[dict[str, Any]]:
    bridges = get_bridges_df()
    results = []
    today = date.today()
    for bridge_id in bridges["bridge_id"]:
        pred = predict_transfusion_cycle(bridge_id)
        if pred and pred["days_until_need"] <= within_days:
            results.append(pred)
    results.sort(key=lambda x: x["days_until_need"])
    return results


def match_donors(
    blood_group: str,
    latitude: float = 17.39,
    longitude: float = 78.46,
    limit: int = 10,
    bridge_id: str | None = None,
) -> list[dict[str, Any]]:
    donors = get_donors_df()
    compatible = _compatible_groups(blood_group)
    candidates = []

    for _, row in donors.iterrows():
        bg = row.get("blood_group")
        if bg not in compatible:
            continue
        if row.get("eligibility_status") != "eligible":
            continue
        if row.get("user_donation_active_status") == "Inactive":
            continue

        profile = donor_profile(row["user_id"])
        lat = float(row["latitude"]) if row.get("latitude") and not np.isnan(row["latitude"]) else latitude
        lon = float(row["longitude"]) if row.get("longitude") and not np.isnan(row["longitude"]) else longitude
        dist = haversine_km(latitude, longitude, lat, lon)

        score = 0.0
        reasons = []

        if bg == blood_group:
            score += 40
            reasons.append("Exact blood group match")
        else:
            score += 25
            reasons.append(f"Compatible donor ({bg})")

        if dist < 5:
            score += 30
            reasons.append("Within 5 km")
        elif dist < 15:
            score += 20
            reasons.append("Within 15 km")
        elif dist < 30:
            score += 10
            reasons.append("Within 30 km")

        score += profile["response_rate"] * 20
        if profile["response_rate"] > 0.5:
            reasons.append("High response rate")

        donations = profile["donations_till_date"]
        if donations >= 5:
            score += 10
            reasons.append("Experienced donor")
        elif donations >= 1:
            score += 5
            reasons.append("Previous donor")

        if row.get("role") == "Bridge Donor" and bridge_id and row.get("bridge_id") == bridge_id:
            score += 15
            reasons.append("Existing bridge donor")

        candidates.append({
            "user_id": row["user_id"],
            "blood_group": bg,
            "match_score": round(min(100, score), 1),
            "distance_km": round(dist, 2),
            "eligibility_status": row["eligibility_status"],
            "donations_till_date": donations,
            "response_rate": profile["response_rate"],
            "preferred_channel": profile["preferred_channel"],
            "preferred_tone": profile["preferred_tone"],
            "best_contact_hour": profile["best_contact_hour"],
            "reasons": reasons,
        })

    candidates.sort(key=lambda x: x["match_score"], reverse=True)
    return candidates[:limit]

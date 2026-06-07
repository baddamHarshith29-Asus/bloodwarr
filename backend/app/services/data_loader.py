from __future__ import annotations

import math
from datetime import date, datetime
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd

from app.config import settings


def _parse_date(val: Any) -> date | None:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    s = str(val).strip()
    if not s or s.lower() == "nan":
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s[:26], fmt).date()
        except ValueError:
            continue
    return None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@lru_cache(maxsize=1)
def load_dataset() -> pd.DataFrame:
    df = pd.read_csv(settings.dataset_path)
    df["last_transfusion_date_parsed"] = df["last_transfusion_date"].apply(_parse_date)
    df["expected_next_transfusion_date_parsed"] = df["expected_next_transfusion_date"].apply(_parse_date)
    df["next_eligible_date_parsed"] = df["next_eligible_date"].apply(_parse_date)
    df["last_contacted_date_parsed"] = df["last_contacted_date"].apply(_parse_date)
    return df


def get_donors_df() -> pd.DataFrame:
    df = load_dataset()
    mask = df["role"].isin(["Emergency Donor", "Bridge Donor", "Volunteer"])
    return df[mask].copy()


def get_bridges_df() -> pd.DataFrame:
    df = load_dataset()
    bridge_rows = df[df["bridge_id"].notna() & (df["bridge_id"] != "")]
    agg = (
        bridge_rows.groupby("bridge_id")
        .agg(
            bridge_blood_group=("bridge_blood_group", "first"),
            bridge_gender=("bridge_gender", "first"),
            quantity_required=("quantity_required", "first"),
            last_transfusion_date=("last_transfusion_date", "first"),
            expected_next_transfusion_date=("expected_next_transfusion_date", "first"),
            frequency_in_days=("frequency_in_days", "first"),
            status_of_bridge=("status_of_bridge", "first"),
            latitude=("latitude", "first"),
            longitude=("longitude", "first"),
            active_donors=("user_id", "count"),
        )
        .reset_index()
    )
    return agg


def donor_profile(user_id: str) -> dict[str, Any]:
    df = get_donors_df()
    row = df[df["user_id"] == user_id]
    if row.empty:
        return {}
    r = row.iloc[0]
    calls = int(r["total_calls"]) if pd.notna(r["total_calls"]) else 0
    donations = int(r["donations_till_date"]) if pd.notna(r["donations_till_date"]) else 0
    ratio = float(r["calls_to_donations_ratio"]) if pd.notna(r["calls_to_donations_ratio"]) else 0.0
    response_rate = min(1.0, ratio) if ratio > 0 else (0.3 if donations == 0 else 0.5)

    hash_val = abs(hash(user_id))
    channels = ["WhatsApp", "SMS", "Email"]
    tones = ["formal", "casual", "medical_urgency", "personal_story"]
    languages = ["English", "Hindi", "Telugu"]

    return {
        "user_id": user_id,
        "blood_group": r["blood_group"],
        "preferred_channel": channels[hash_val % 3],
        "preferred_tone": tones[hash_val % 4],
        "preferred_language": languages[hash_val % 3],
        "best_contact_hour": 7 + (hash_val % 14),
        "response_rate": round(response_rate, 2),
        "donations_till_date": donations,
        "total_calls": calls,
        "eligibility_status": r["eligibility_status"],
        "latitude": float(r["latitude"]) if pd.notna(r["latitude"]) else 17.39,
        "longitude": float(r["longitude"]) if pd.notna(r["longitude"]) else 78.46,
        "active_status": r["user_donation_active_status"],
    }


def dashboard_stats() -> dict[str, Any]:
    df = load_dataset()
    donors = get_donors_df()
    bridges = get_bridges_df()
    today = date.today()

    upcoming = 0
    pre_staging = 0
    for _, b in bridges.iterrows():
        nd = _parse_date(b.get("expected_next_transfusion_date"))
        if nd:
            days = (nd - today).days
            if 0 <= days <= 7:
                upcoming += 1
            if 0 <= days <= 3:
                pre_staging += 1

    bg = donors["blood_group"].value_counts().to_dict()
    roles = df["role"].value_counts().to_dict()
    freq = bridges["frequency_in_days"].dropna()
    avg_freq = float(freq.mean()) if len(freq) else 21.0

    eligible = int((donors["eligibility_status"] == "eligible").sum())
    active = int((donors["user_donation_active_status"] == "Active").sum())
    ratios = donors["calls_to_donations_ratio"].dropna()
    success = float(ratios.mean()) if len(ratios) else 0.35
    success = min(1.0, max(0.1, success))

    return {
        "total_users": len(df),
        "total_donors": len(donors),
        "total_bridges": len(bridges),
        "eligible_donors": eligible,
        "active_donors": active,
        "upcoming_transfusions_7d": upcoming,
        "pre_staging_active": pre_staging,
        "blood_group_distribution": {str(k): int(v) for k, v in bg.items()},
        "role_distribution": {str(k): int(v) for k, v in roles.items()},
        "avg_donation_frequency_days": round(avg_freq, 1),
        "outreach_success_rate": round(success, 2),
    }

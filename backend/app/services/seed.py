from __future__ import annotations

import hashlib
from datetime import date, timedelta

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Donor, Patient, SessionLocal, init_db
from app.services.data_loader import _parse_date, load_dataset

HOSPITALS = [
    "Apollo Hospital", "Yashoda Hospital", "KIMS Hospital",
    "Care Hospital", "Rainbow Children's Hospital", "Fernandez Hospital",
]
CITIES = ["Hyderabad", "Secunderabad", "Gachibowli", "Banjara Hills"]
LANGUAGES = ["English", "Hindi", "Telugu"]
CHANNELS = ["WhatsApp", "SMS", "Email"]


INDIAN_NAMES = [
    "Ramesh", "Akhil", "Priya", "Suresh", "Lakshmi", "Kiran", "Ananya", "Vikram",
    "Meera", "Arjun", "Divya", "Rajesh", "Sneha", "Karthik", "Pooja", "Naveen",
    "Swathi", "Harish", "Deepa", "Manoj", "Sunita", "Rahul", "Kavya", "Srinivas",
]
TIME_PERIODS = ["Morning", "Afternoon", "Evening"]


def _patient_name(bridge_id: str, idx: int) -> str:
    if idx == 1:
        return "Rahul Kumar"
    return f"Patient {INDIAN_NAMES[idx % len(INDIAN_NAMES)]}"


def _donor_name(user_id: str, idx: int) -> str:
    demo = {1: "Ramesh", 2: "Akhil", 3: "Priya"}
    return demo.get(idx, INDIAN_NAMES[idx % len(INDIAN_NAMES)])


def seed_database(force: bool = False) -> dict:
    init_db()
    db = SessionLocal()
    try:
        if db.query(Patient).count() > 0 and not force:
            return {
                "patients": db.query(Patient).count(),
                "donors": db.query(Donor).count(),
                "seeded": False,
            }

        if force:
            from app.database import BloodRequest, Conversation, MatchResult, Notification, OutreachHistory, Prediction
            db.query(Notification).delete()
            db.query(OutreachHistory).delete()
            db.query(Conversation).delete()
            db.query(MatchResult).delete()
            db.query(Prediction).delete()
            db.query(BloodRequest).delete()
            db.query(Donor).delete()
            db.query(Patient).delete()
            db.commit()

        df = load_dataset()
        bridge_rows = df[df["bridge_id"].notna() & (df["bridge_id"] != "")].drop_duplicates("bridge_id")
        patient_idx = 1

        for _, row in bridge_rows.iterrows():
            bid = str(row["bridge_id"])
            last = _parse_date(row.get("last_transfusion_date"))
            freq = row.get("frequency_in_days")
            gap = int(freq) if pd.notna(freq) and not np.isnan(freq) else 21
            gap = max(14, min(30, gap))
            h = abs(hash(bid))
            is_rahul = patient_idx == 1
            last = date.today() - timedelta(days=15) if is_rahul else _parse_date(row.get("last_transfusion_date"))
            gap = 18 if is_rahul else gap
            db.add(Patient(
                name=_patient_name(bid, patient_idx),
                blood_group="A Positive" if is_rahul else str(row.get("bridge_blood_group") or row.get("blood_group") or "O Positive"),
                hospital=HOSPITALS[h % len(HOSPITALS)],
                city="Hyderabad" if is_rahul else CITIES[h % len(CITIES)],
                last_transfusion_date=last,
                avg_gap_days=gap,
                medical_notes="Thalassemia Major — requires transfusion every 18 days" if is_rahul else "",
                latitude=float(row["latitude"]) if pd.notna(row.get("latitude")) else 17.39,
                longitude=float(row["longitude"]) if pd.notna(row.get("longitude")) else 78.46,
                bridge_id=bid,
            ))
            patient_idx += 1

        patient_role = df[df["role"] == "Patient"].drop_duplicates("user_id")
        for _, row in patient_role.iterrows():
            uid = str(row["user_id"])
            if db.query(Patient).filter(Patient.bridge_id == uid).first():
                continue
            last = _parse_date(row.get("last_transfusion_date"))
            h = abs(hash(uid))
            db.add(Patient(
                name=f"Thalassemia Patient {patient_idx}",
                blood_group=str(row.get("blood_group") or "O Positive"),
                hospital=HOSPITALS[h % len(HOSPITALS)],
                city=CITIES[h % len(CITIES)],
                last_transfusion_date=last,
                avg_gap_days=21,
                latitude=float(row["latitude"]) if pd.notna(row.get("latitude")) else 17.39,
                longitude=float(row["longitude"]) if pd.notna(row.get("longitude")) else 78.46,
                bridge_id=uid,
            ))
            patient_idx += 1

        donors_df = df[df["role"].isin(["Emergency Donor", "Bridge Donor", "Volunteer"])].drop_duplicates("user_id")
        donor_idx = 1
        seen_uids: set[str] = set()
        for _, row in donors_df.iterrows():
            uid = str(row["user_id"])
            if uid in seen_uids:
                continue
            seen_uids.add(uid)
            if db.query(Donor).filter(Donor.user_id == uid).first():
                continue
            h = abs(hash(uid))
            calls = int(row["total_calls"]) if pd.notna(row.get("total_calls")) else 0
            donations = int(row["donations_till_date"]) if pd.notna(row.get("donations_till_date")) else 0
            ratio = float(row["calls_to_donations_ratio"]) if pd.notna(row.get("calls_to_donations_ratio")) else 0.0
            response_rate = min(1.0, ratio) if ratio > 0 else (0.3 if donations == 0 else 0.5)
            eligible = row.get("eligibility_status") == "eligible"
            active = row.get("user_donation_active_status") == "Active"
            availability = "available" if eligible and active else "unavailable"

            db.add(Donor(
                name=_donor_name(uid, donor_idx),
                blood_group="A Positive" if donor_idx <= 3 else str(row.get("blood_group") or "O Positive"),
                city=CITIES[h % len(CITIES)],
                contact=f"+91{9000000000 + (h % 999999999):010d}"[-10:],
                availability_status="available" if donor_idx <= 3 else availability,
                donation_count=max(donations, 5 - donor_idx) if donor_idx <= 3 else donations,
                preferred_language=LANGUAGES[donor_idx % 3],
                preferred_channel=CHANNELS[donor_idx % 3],
                preferred_contact_hour=7 + (h % 14),
                preferred_time_period=TIME_PERIODS[donor_idx % 3],
                response_rate=0.95 if donor_idx == 1 else (0.89 if donor_idx == 2 else (0.82 if donor_idx == 3 else round(response_rate, 2))),
                latitude=float(row["latitude"]) if pd.notna(row.get("latitude")) else 17.39,
                longitude=float(row["longitude"]) if pd.notna(row.get("longitude")) else 78.46,
                user_id=uid,
            ))
            donor_idx += 1

        db.commit()
        return {
            "patients": db.query(Patient).count(),
            "donors": db.query(Donor).count(),
            "seeded": True,
        }
    finally:
        db.close()

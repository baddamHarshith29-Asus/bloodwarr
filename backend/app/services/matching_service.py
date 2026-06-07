from __future__ import annotations

import json
import math

from sqlalchemy.orm import Session

from app.database import BloodRequest, Donor, MatchResult


def _compatible_groups(required: str) -> set[str]:
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


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _busy_donor_ids(db: Session) -> set[int]:
    active_matches = (
        db.query(MatchResult.donor_id)
        .join(BloodRequest)
        .filter(
            BloodRequest.status.in_(["Pending", "Matched", "Critical"]),
            MatchResult.status.in_(["assigned", "responded"]),
        )
        .all()
    )
    return {m[0] for m in active_matches}


def score_donor(
    donor: Donor,
    blood_group: str,
    patient_lat: float,
    patient_lon: float,
) -> tuple[float, float, list[str]]:
    score = 0.0
    reasons = []
    dist = haversine_km(patient_lat, patient_lon, donor.latitude, donor.longitude)

    if donor.blood_group == blood_group:
        score += 40
        reasons.append("Exact blood group match")
    elif donor.blood_group in _compatible_groups(blood_group):
        score += 25
        reasons.append(f"Compatible ({donor.blood_group})")

    if dist < 5:
        score += 30
        reasons.append("Within 5 km")
    elif dist < 15:
        score += 20
        reasons.append("Within 15 km")
    elif dist < 30:
        score += 10
        reasons.append("Within 30 km")

    if donor.availability_status == "available":
        score += 15
        reasons.append("Available now")
    else:
        score -= 20

    score += donor.response_rate * 15
    if donor.response_rate > 0.5:
        reasons.append("High response rate")

    if donor.donation_count >= 5:
        score += 10
        reasons.append("Experienced donor")
    elif donor.donation_count >= 1:
        score += 5
        reasons.append("Previous donor")

    return round(min(100, max(0, score)), 1), round(dist, 2), reasons


def match_donors_for_request(db: Session, request_id: int, top_n: int = 5, round_num: int = 1) -> list[MatchResult]:
    req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not req:
        raise ValueError("Request not found")

    patient = req.patient
    busy = _busy_donor_ids(db)
    compatible = _compatible_groups(req.blood_group)

    candidates = []
    donors = db.query(Donor).filter(Donor.blood_group.in_(compatible)).all()

    already_matched = {
        m.donor_id
        for m in db.query(MatchResult).filter(MatchResult.request_id == request_id).all()
    }

    for donor in donors:
        if donor.id in busy and donor.id not in already_matched:
            continue
        if donor.id in already_matched:
            continue
        if donor.availability_status != "available":
            continue

        score, dist, reasons = score_donor(donor, req.blood_group, patient.latitude, patient.longitude)
        candidates.append((donor, score, dist, reasons))

    candidates.sort(key=lambda x: x[1], reverse=True)
    top = candidates[:top_n]

    results = []
    for rank, (donor, score, dist, reasons) in enumerate(top, 1):
        mr = MatchResult(
            request_id=request_id,
            donor_id=donor.id,
            score=score,
            rank=rank,
            distance_km=dist,
            status="assigned",
            reasons=json.dumps(reasons),
            outreach_round=round_num,
        )
        db.add(mr)
        results.append(mr)

    if results:
        req.status = "Searching Donors"
        req.escalation_round = round_num

    db.commit()
    for r in results:
        db.refresh(r)
    return results


def get_matches_for_request(db: Session, request_id: int) -> list[dict]:
    matches = (
        db.query(MatchResult)
        .filter(MatchResult.request_id == request_id)
        .order_by(MatchResult.outreach_round, MatchResult.rank)
        .all()
    )
    out = []
    for m in matches:
        d = m.donor
        out.append({
            "id": m.id,
            "donor_id": m.donor_id,
            "donor_name": d.name if d else "",
            "blood_group": d.blood_group if d else "",
            "score": m.score,
            "rank": m.rank,
            "distance_km": m.distance_km,
            "status": m.status,
            "reasons": json.loads(m.reasons) if m.reasons else [],
            "round": m.outreach_round,
            "preferred_language": d.preferred_language if d else "",
            "preferred_channel": d.preferred_channel if d else "",
            "preferred_time": (d.preferred_time_period or "Morning") if d else "Morning",
            "scheduled_time": m.scheduled_time or "",
            "donation_date": str(m.donation_date) if m.donation_date else "",
        })
    return out

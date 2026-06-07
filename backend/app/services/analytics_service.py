from __future__ import annotations

from sqlalchemy.orm import Session

from app.database import BloodRequest, Donor, Notification, Prediction
from app.services.prediction_service import get_upcoming_predictions


def get_analytics(db: Session) -> dict:
    requests = db.query(BloodRequest).all()
    donors = db.query(Donor).all()
    notifs = db.query(Notification).all()

    requests_by_bg: dict[str, int] = {}
    for r in requests:
        requests_by_bg[r.blood_group] = requests_by_bg.get(r.blood_group, 0) + 1

    responded = sum(1 for n in notifs if n.status == "responded")
    success_rate = round(responded / max(1, len(notifs)), 2)

    active_donors = sum(1 for d in donors if d.availability_status == "available")
    predicted_future = get_upcoming_predictions(db, within_days=30)

    status_breakdown: dict[str, int] = {}
    for r in requests:
        status_breakdown[r.status] = status_breakdown.get(r.status, 0) + 1

    completed = status_breakdown.get("Completed", 0) + status_breakdown.get("Fulfilled", 0)

    return {
        "requests_by_blood_group": requests_by_bg,
        "donation_success_rate": success_rate,
        "active_donors": active_donors,
        "total_donors": len(donors),
        "predicted_future_requests": len([p for p in predicted_future if p["days_until"] <= 7]),
        "predicted_future_detail": predicted_future[:15],
        "request_status_breakdown": status_breakdown,
        "completed_donations": completed,
        "total_notifications": len(notifs),
        "total_predictions_stored": db.query(Prediction).count(),
    }

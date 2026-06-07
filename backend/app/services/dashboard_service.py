from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.database import BloodRequest, Donor, Notification, Patient, Prediction
from app.services.prediction_service import get_upcoming_predictions


def get_dashboard(db: Session) -> dict:
    today = date.today()
    patients = db.query(Patient).count()
    donors = db.query(Donor).count()
    available = db.query(Donor).filter(Donor.availability_status == "available").count()
    pending_requests = db.query(BloodRequest).filter(BloodRequest.status == "Pending").count()
    searching = db.query(BloodRequest).filter(BloodRequest.status == "Searching Donors").count()
    confirmed = db.query(BloodRequest).filter(BloodRequest.status == "Donor Confirmed").count()
    completed = db.query(BloodRequest).filter(BloodRequest.status.in_(["Completed", "Fulfilled"])).count()
    active_requests = pending_requests + searching + confirmed
    total_predictions = db.query(Prediction).count()
    upcoming = get_upcoming_predictions(db, within_days=7)
    pre_staging = [p for p in upcoming if 0 <= p["days_until"] <= 3]
    notifications_sent = db.query(Notification).count()
    responses = db.query(Notification).filter(Notification.status == "responded").count()

    bg_dist = {}
    for d in db.query(Donor.blood_group).all():
        bg = d[0] or "Unknown"
        bg_dist[bg] = bg_dist.get(bg, 0) + 1

    recent_requests = (
        db.query(BloodRequest)
        .order_by(BloodRequest.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "total_patients": patients,
        "total_donors": donors,
        "available_donors": available,
        "active_requests": active_requests,
        "pending_requests": pending_requests,
        "searching_donors": searching,
        "donor_confirmed": confirmed,
        "completed_donations": completed,
        "predicted_requests": len(pre_staging),
        "total_predictions": total_predictions,
        "upcoming_transfusions_7d": len(upcoming),
        "pre_staging_active": len(pre_staging),
        "notifications_sent": notifications_sent,
        "donor_response_rate": round(responses / max(1, notifications_sent), 2),
        "blood_group_distribution": bg_dist,
        "upcoming_predictions": upcoming[:10],
        "recent_requests": [
            {
                "id": r.id,
                "patient_name": r.patient.name if r.patient else "",
                "blood_group": r.blood_group,
                "status": r.status,
                "urgency": r.urgency,
                "source": r.source,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in recent_requests
        ],
        "critical_alerts": db.query(BloodRequest).filter(BloodRequest.status == "Critical").count() > 0,
    }

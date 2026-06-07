from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.database import BloodRequest, Patient, Prediction


def predict_for_patient(patient: Patient, today: date | None = None) -> dict:
    today = today or date.today()
    if patient.last_transfusion_date:
        predicted = patient.last_transfusion_date + timedelta(days=patient.avg_gap_days)
        confidence = 0.92
    else:
        predicted = today + timedelta(days=patient.avg_gap_days)
        confidence = 0.70

    days_until = (predicted - today).days
    return {
        "predicted_date": predicted,
        "confidence": confidence,
        "days_until": days_until,
    }


def run_daily_predictions(db: Session) -> dict:
    today = date.today()
    patients = db.query(Patient).all()
    created_predictions = 0
    auto_requests = 0

    for patient in patients:
        pred_data = predict_for_patient(patient, today)

        prediction = Prediction(
            patient_id=patient.id,
            predicted_date=pred_data["predicted_date"],
            confidence=pred_data["confidence"],
            days_until=pred_data["days_until"],
        )

        if 0 <= pred_data["days_until"] <= 3:
            existing = (
                db.query(BloodRequest)
                .filter(
                    BloodRequest.patient_id == patient.id,
                    BloodRequest.status.in_(["Pending", "Matched", "Critical"]),
                )
                .first()
            )
            if not existing:
                req = BloodRequest(
                    patient_id=patient.id,
                    blood_group=patient.blood_group,
                    quantity=1,
                    status="Pending",
                    urgency="high" if pred_data["days_until"] <= 1 else "normal",
                    source="prediction",
                    required_date=pred_data["predicted_date"],
                )
                db.add(req)
                db.flush()
                prediction.auto_request_created = True
                prediction.blood_request_id = req.id
                auto_requests += 1

        db.add(prediction)
        created_predictions += 1

    db.commit()
    return {
        "patients_processed": len(patients),
        "predictions_created": created_predictions,
        "auto_requests_created": auto_requests,
        "run_at": datetime.utcnow().isoformat(),
    }


def get_upcoming_predictions(db: Session, within_days: int = 30) -> list[dict]:
    today = date.today()
    patients = db.query(Patient).all()
    results = []
    for p in patients:
        pred = predict_for_patient(p, today)
        if pred["days_until"] <= within_days:
            results.append({
                "patient_id": p.id,
                "patient_name": p.name,
                "blood_group": p.blood_group,
                "hospital": p.hospital,
                "city": p.city,
                "last_transfusion_date": str(p.last_transfusion_date) if p.last_transfusion_date else None,
                "avg_gap_days": p.avg_gap_days,
                "predicted_date": str(pred["predicted_date"]),
                "confidence": pred["confidence"],
                "days_until": pred["days_until"],
                "needs_request": 0 <= pred["days_until"] <= 3,
            })
    results.sort(key=lambda x: x["days_until"])
    return results


def get_stored_predictions(db: Session, limit: int = 50) -> list[dict]:
    preds = db.query(Prediction).order_by(Prediction.created_at.desc()).limit(limit).all()
    out = []
    today = date.today()
    for pr in preds:
        p = pr.patient
        dynamic_days_until = (pr.predicted_date - today).days
        out.append({
            "id": pr.id,
            "patient_id": pr.patient_id,
            "patient_name": p.name if p else "Unknown",
            "blood_group": p.blood_group if p else "",
            "predicted_date": str(pr.predicted_date),
            "confidence": pr.confidence,
            "days_until": dynamic_days_until,
            "auto_request_created": pr.auto_request_created,
            "request_created": pr.auto_request_created or bool(pr.blood_request_id),
            "blood_request_id": pr.blood_request_id,
            "created_at": pr.created_at.isoformat() if pr.created_at else None,
        })
    return out



def create_request_from_prediction(db: Session, patient_id: int) -> BloodRequest:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise ValueError("Patient not found")

    pred = predict_for_patient(patient)
    req = BloodRequest(
        patient_id=patient.id,
        blood_group=patient.blood_group,
        quantity=1,
        status="Pending",
        urgency="high" if pred["days_until"] <= 1 else "normal",
        source="prediction_manual",
        required_date=pred["predicted_date"],
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req

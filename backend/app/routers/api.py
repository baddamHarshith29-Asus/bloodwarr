from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    BloodRequest,
    ChatRequest,
    ChatResponse,
    DashboardStats,
    DonorRecord,
    MatchResponse,
    TransfusionPrediction,
)
from app.services.data_loader import dashboard_stats, donor_profile, get_bridges_df, get_donors_df
from app.services.matching import list_predictions, match_donors, predict_transfusion_cycle
from app.services.outreach import generate_outreach, run_outreach_campaign
from app.services.protocol_engine import (
    chat_with_memory,
    create_blood_request,
    get_conversation_history,
    get_failure_history,
    get_protocol,
    record_failure,
)

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "service": "BloodMind"}


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard():
    return dashboard_stats()


@router.get("/donors")
def list_donors(
    blood_group: str | None = None,
    eligible_only: bool = False,
    active_only: bool = False,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    df = get_donors_df()
    if blood_group:
        df = df[df["blood_group"] == blood_group]
    if eligible_only:
        df = df[df["eligibility_status"] == "eligible"]
    if active_only:
        df = df[df["user_donation_active_status"] == "Active"]
    total = len(df)
    rows = df.iloc[offset : offset + limit]
    records = []
    for _, r in rows.iterrows():
        records.append({
            "user_id": r["user_id"][:16] + "...",
            "user_id_full": r["user_id"],
            "role": r["role"],
            "blood_group": r["blood_group"],
            "gender": r["gender"],
            "eligibility_status": r["eligibility_status"],
            "donations_till_date": int(r["donations_till_date"]) if r["donations_till_date"] == r["donations_till_date"] else 0,
            "user_donation_active_status": r["user_donation_active_status"],
            "donor_type": r["donor_type"],
        })
    return {"total": total, "donors": records}


@router.get("/donors/{user_id}")
def get_donor(user_id: str):
    profile = donor_profile(user_id)
    if not profile:
        raise HTTPException(404, "Donor not found")
    return profile


@router.get("/bridges")
def list_bridges(limit: int = Query(50, le=200)):
    df = get_bridges_df()
    records = []
    for _, b in df.head(limit).iterrows():
        pred = predict_transfusion_cycle(b["bridge_id"])
        records.append({
            "bridge_id": b["bridge_id"][:16] + "...",
            "bridge_id_full": b["bridge_id"],
            "bridge_blood_group": b["bridge_blood_group"],
            "quantity_required": int(b["quantity_required"]) if b["quantity_required"] == b["quantity_required"] else 1,
            "last_transfusion_date": b["last_transfusion_date"],
            "expected_next_transfusion_date": b["expected_next_transfusion_date"],
            "frequency_in_days": int(b["frequency_in_days"]) if b["frequency_in_days"] == b["frequency_in_days"] else 21,
            "active_donors": int(b["active_donors"]),
            "prediction": pred,
        })
    return {"total": len(df), "bridges": records}


@router.get("/predictions")
def get_predictions(within_days: int = 30):
    preds = list_predictions(within_days)
    return {"count": len(preds), "predictions": preds}


@router.get("/predictions/{bridge_id}", response_model=TransfusionPrediction)
def get_prediction(bridge_id: str):
    pred = predict_transfusion_cycle(bridge_id)
    if not pred:
        raise HTTPException(404, "Bridge not found")
    return pred


@router.post("/match", response_model=MatchResponse)
def match_request(req: BloodRequest):
    request = create_blood_request(req.bridge_id, req.blood_group, req.quantity)
    lat = req.latitude or 17.39
    lon = req.longitude or 78.46
    candidates = match_donors(req.blood_group, lat, lon, limit=10, bridge_id=req.bridge_id)
    protocol = get_protocol()
    escalated = len(candidates) < req.quantity
    return MatchResponse(
        request_id=request["request_id"],
        bridge_id=req.bridge_id,
        candidates=candidates,
        protocol_version=protocol["version"],
        escalated=escalated,
    )


@router.get("/match")
def match_get(
    blood_group: str,
    bridge_id: str | None = None,
    latitude: float = 17.39,
    longitude: float = 78.46,
    limit: int = 10,
):
    candidates = match_donors(blood_group, latitude, longitude, limit, bridge_id)
    return {"candidates": candidates, "protocol_version": get_protocol()["version"]}


@router.post("/outreach")
def outreach(donor_id: str, blood_group: str, bridge_id: str | None = None):
    msg = generate_outreach(donor_id, blood_group, bridge_id)
    if "error" in msg:
        raise HTTPException(404, msg["error"])
    return msg


@router.post("/outreach/campaign")
def outreach_campaign(blood_group: str, donor_ids: list[str], bridge_id: str | None = None):
    return {"messages": run_outreach_campaign(blood_group, donor_ids, bridge_id)}


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    result = chat_with_memory(req.user_id, req.message)
    return ChatResponse(**result)


@router.get("/chat/{user_id}/history")
def chat_history(user_id: str):
    return {"history": get_conversation_history(user_id)}


@router.get("/protocol")
def protocol():
    return get_protocol()


@router.post("/protocol/failure")
def simulate_failure(bridge_id: str, blood_group: str, outreach_count: int = 10, responses: int = 0, duration_hours: float = 6.0):
    return record_failure(bridge_id, blood_group, outreach_count, responses, duration_hours)


@router.get("/protocol/failures")
def failures():
    return {"failures": get_failure_history()}


@router.get("/analytics/blood-groups")
def blood_group_analytics():
    stats = dashboard_stats()
    return {"distribution": stats["blood_group_distribution"]}


@router.get("/analytics/engagement")
def engagement_analytics():
    df = get_donors_df()
    active = int((df["user_donation_active_status"] == "Active").sum())
    inactive = int((df["user_donation_active_status"] == "Inactive").sum())
    avg_calls = float(df["total_calls"].mean()) if len(df) else 0
    avg_donations = float(df["donations_till_date"].mean()) if len(df) else 0
    return {
        "active_donors": active,
        "inactive_donors": inactive,
        "avg_calls_per_donor": round(avg_calls, 1),
        "avg_donations_per_donor": round(avg_donations, 1),
        "retention_rate": round(active / max(1, active + inactive), 2),
    }

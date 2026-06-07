from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class BloodGroup(str, Enum):
    A_POS = "A Positive"
    A_NEG = "A Negative"
    B_POS = "B Positive"
    B_NEG = "B Negative"
    AB_POS = "AB Positive"
    AB_NEG = "AB Negative"
    O_POS = "O Positive"
    O_NEG = "O Negative"


class DonorRecord(BaseModel):
    user_id: str
    role: str
    blood_group: Optional[str] = None
    gender: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    donor_type: Optional[str] = None
    eligibility_status: Optional[str] = None
    donations_till_date: Optional[int] = None
    last_donation_date: Optional[str] = None
    next_eligible_date: Optional[str] = None
    total_calls: Optional[int] = None
    calls_to_donations_ratio: Optional[float] = None
    user_donation_active_status: Optional[str] = None
    bridge_id: Optional[str] = None


class BridgeRecord(BaseModel):
    bridge_id: str
    bridge_blood_group: Optional[str] = None
    bridge_gender: Optional[str] = None
    quantity_required: Optional[int] = None
    last_transfusion_date: Optional[str] = None
    expected_next_transfusion_date: Optional[str] = None
    frequency_in_days: Optional[int] = None
    status_of_bridge: Optional[str] = None
    active_donors: int = 0


class MatchCandidate(BaseModel):
    user_id: str
    blood_group: str
    match_score: float
    distance_km: float
    eligibility_status: str
    donations_till_date: int
    response_rate: float
    preferred_channel: str
    preferred_tone: str
    best_contact_hour: int
    reasons: list[str]


class TransfusionPrediction(BaseModel):
    bridge_id: str
    bridge_blood_group: str
    last_transfusion_date: Optional[str]
    predicted_next_date: str
    confidence: float
    days_until_need: int
    pre_staging_due: bool
    frequency_days: int


class OutreachMessage(BaseModel):
    donor_id: str
    channel: str
    language: str
    tone: str
    message: str
    scheduled_at: str
    bridge_id: Optional[str] = None


class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: str


class ChatRequest(BaseModel):
    user_id: str
    message: str


class ChatResponse(BaseModel):
    user_id: str
    reply: str
    memory_used: list[str]
    guardrail_passed: bool


class DashboardStats(BaseModel):
    total_users: int
    total_donors: int
    total_bridges: int
    eligible_donors: int
    active_donors: int
    upcoming_transfusions_7d: int
    pre_staging_active: int
    blood_group_distribution: dict[str, int]
    role_distribution: dict[str, int]
    avg_donation_frequency_days: float
    outreach_success_rate: float


class BloodRequest(BaseModel):
    bridge_id: str
    blood_group: str
    quantity: int = 1
    urgency: str = "normal"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class MatchResponse(BaseModel):
    request_id: str
    bridge_id: str
    candidates: list[MatchCandidate]
    protocol_version: str
    escalated: bool


class ProtocolUpdate(BaseModel):
    version: str
    trigger: str
    changes: list[str]
    created_at: str


class FailureReport(BaseModel):
    request_id: str
    bridge_id: str
    blood_group: str
    outreach_count: int
    responses: int
    duration_hours: float
    recommended_protocol: dict

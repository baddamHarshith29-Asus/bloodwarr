"""
Amazon Kinesis Data Streams — Layer 2 (Data Engineering)
=========================================================
Publishes all Blood Warriors events to Kinesis for:
- Real-time analytics dashboards
- Lambda consumers (donor response webhooks)
- AWS Glue ETL → S3 data lake pipeline triggers
- Audit trail

Stream: blood-warriors-events

Events Published:
- DonorRegistered
- PatientRegistered
- RequestCreated
- MatchCompleted
- OutreachSent
- DonorResponded
- AppointmentScheduled
- DonationCompleted
- PipelineRun

Falls back to local logging when Kinesis unavailable (local dev).
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

_kinesis_client = None
KINESIS_AVAILABLE = False
STREAM_NAME = os.environ.get("KINESIS_STREAM_NAME", "blood-warriors-events")

# In-memory event log for local dev / UI display
_local_event_log: list[dict] = []
MAX_LOCAL_LOG = 500


def _get_kinesis_client():
    global _kinesis_client, KINESIS_AVAILABLE
    if _kinesis_client is not None:
        return _kinesis_client
    try:
        import boto3
        session = boto3.Session()
        credentials = session.get_credentials()
        if not credentials:
            raise ValueError("No AWS credentials found in local environment")
            
        region = os.environ.get("AWS_REGION", "ap-south-1")
        _kinesis_client = boto3.client("kinesis", region_name=region)
        # Verify stream exists
        _kinesis_client.describe_stream_summary(StreamName=STREAM_NAME)
        KINESIS_AVAILABLE = True
        logger.info("✅ Kinesis stream '%s' connected", STREAM_NAME)
    except Exception as e:
        logger.warning("⚠️  Kinesis unavailable — using local event log: %s", e)
        KINESIS_AVAILABLE = False
        _kinesis_client = None
    return _kinesis_client



def publish_event(event_type: str, payload: dict, partition_key: str | None = None) -> dict:
    """
    Publish an event to Kinesis or local event log.
    partition_key defaults to event_type for balanced sharding.
    """
    event = {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "payload": payload,
        "source": "blood-warriors-api",
    }

    # Always store locally for UI visibility
    _local_event_log.append(event)
    if len(_local_event_log) > MAX_LOCAL_LOG:
        _local_event_log.pop(0)

    # Try Kinesis
    client = _get_kinesis_client()
    if client:
        try:
            client.put_record(
                StreamName=STREAM_NAME,
                Data=json.dumps(event).encode("utf-8"),
                PartitionKey=partition_key or event_type,
            )
            event["stream"] = "kinesis"
            logger.debug("Published to Kinesis: %s", event_type)
        except Exception as e:
            logger.warning("Kinesis publish failed: %s", e)
            event["stream"] = "local"
    else:
        event["stream"] = "local"

    return event


# ─── Typed Event Publishers ───────────────────────────────────────────────────

def event_donor_registered(donor_id: int, name: str, blood_group: str, city: str, language: str):
    return publish_event("DonorRegistered", {
        "donor_id": donor_id, "name": name,
        "blood_group": blood_group, "city": city, "preferred_language": language,
    }, partition_key=f"donor-{donor_id}")


def event_patient_registered(patient_id: int, name: str, blood_group: str, hospital: str, city: str):
    return publish_event("PatientRegistered", {
        "patient_id": patient_id, "name": name,
        "blood_group": blood_group, "hospital": hospital, "city": city,
    }, partition_key=f"patient-{patient_id}")


def event_request_created(request_id: int, patient_id: int, blood_group: str, urgency: str, source: str):
    return publish_event("RequestCreated", {
        "request_id": request_id, "patient_id": patient_id,
        "blood_group": blood_group, "urgency": urgency, "source": source,
    }, partition_key=f"request-{request_id}")


def event_match_completed(request_id: int, match_count: int, top_donor_name: str, top_score: float):
    return publish_event("MatchCompleted", {
        "request_id": request_id, "match_count": match_count,
        "top_donor_name": top_donor_name, "top_score": top_score,
    }, partition_key=f"request-{request_id}")


def event_outreach_sent(request_id: int, donor_id: int, channel: str, language: str, ai_source: str):
    return publish_event("OutreachSent", {
        "request_id": request_id, "donor_id": donor_id,
        "channel": channel, "language": language, "ai_source": ai_source,
    }, partition_key=f"donor-{donor_id}")


def event_donor_responded(request_id: int, donor_id: int, donor_name: str, response: str, response_time_hours: float):
    return publish_event("DonorResponded", {
        "request_id": request_id, "donor_id": donor_id, "donor_name": donor_name,
        "response": response, "response_time_hours": response_time_hours,
    }, partition_key=f"donor-{donor_id}")


def event_appointment_scheduled(request_id: int, donor_id: int, donor_name: str, scheduled_time: str, donation_date: str):
    return publish_event("AppointmentScheduled", {
        "request_id": request_id, "donor_id": donor_id, "donor_name": donor_name,
        "scheduled_time": scheduled_time, "donation_date": donation_date,
    }, partition_key=f"request-{request_id}")


def event_donation_completed(request_id: int, donor_id: int, donor_name: str, patient_name: str, blood_group: str):
    return publish_event("DonationCompleted", {
        "request_id": request_id, "donor_id": donor_id, "donor_name": donor_name,
        "patient_name": patient_name, "blood_group": blood_group,
    }, partition_key=f"donor-{donor_id}")


def event_pipeline_run(run_at: str, predictions: int, requests_created: int, matched: int, outreach: int):
    return publish_event("PipelineRun", {
        "run_at": run_at, "predictions_run": predictions,
        "requests_auto_created": requests_created,
        "requests_matched": matched, "outreach_sent": outreach,
    }, partition_key="pipeline")


# ─── Event Log Access ─────────────────────────────────────────────────────────

def get_recent_events(limit: int = 50, event_type: str | None = None) -> list[dict]:
    """Return recent events from local log (reverse chronological)."""
    events = list(reversed(_local_event_log))
    if event_type:
        events = [e for e in events if e["event_type"] == event_type]
    return events[:limit]


def get_kinesis_status() -> dict:
    _get_kinesis_client()
    return {
        "available": KINESIS_AVAILABLE,
        "stream_name": STREAM_NAME,
        "local_event_count": len(_local_event_log),
        "region": os.environ.get("AWS_REGION", "ap-south-1"),
    }

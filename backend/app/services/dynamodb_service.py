"""
Amazon DynamoDB — Layer 2 (Real-Time State Cache)
==================================================
Tables:
1. bw-donor-availability   — Real-time donor availability cache (sub-ms read)
2. bw-conversations        — Bedrock conversation sessions per donor
3. bw-pipeline-runs        — Pipeline execution history

Falls back to in-memory dict when DynamoDB unavailable (local dev).
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

_dynamodb = None
DYNAMODB_AVAILABLE = False

# In-memory fallback stores
_availability_cache: dict[str, dict] = {}
_conversation_cache: dict[str, list] = {}
_pipeline_runs: list[dict] = []


def _get_dynamodb():
    global _dynamodb, DYNAMODB_AVAILABLE
    if _dynamodb is not None:
        return _dynamodb
    try:
        import boto3
        session = boto3.Session()
        credentials = session.get_credentials()
        if not credentials:
            raise ValueError("No AWS credentials found in local environment")
            
        region = os.environ.get("AWS_REGION", "ap-south-1")
        # List tables to verify connection and deployment
        table_names = boto3.client("dynamodb", region_name=region).list_tables()["TableNames"]
        if "bw-donor-availability" not in table_names:
            raise ValueError("Tables not deployed in AWS account yet (run terraform apply first)")
            
        _dynamodb = boto3.resource("dynamodb", region_name=region)
        DYNAMODB_AVAILABLE = True
        logger.info("✅ DynamoDB connected (region: %s)", region)
    except Exception as e:
        logger.warning("⚠️  DynamoDB unavailable — using in-memory cache: %s", e)
        DYNAMODB_AVAILABLE = False
        _dynamodb = None
    return _dynamodb




# ─── Table: bw-donor-availability ─────────────────────────────────────────────

def cache_donor_availability(donor_id: int, status: str, blood_group: str,
                              city: str, preferred_time: str, score: float = 0.0):
    """Cache donor real-time availability state."""
    item = {
        "donor_id": str(donor_id),
        "status": status,
        "blood_group": blood_group,
        "city": city,
        "preferred_time": preferred_time,
        "score": str(score),
        "updated_at": datetime.utcnow().isoformat(),
        "ttl": int((datetime.utcnow() + timedelta(hours=24)).timestamp()),
    }

    db = _get_dynamodb()
    if db:
        try:
            table = db.Table("bw-donor-availability")
            table.put_item(Item=item)
        except Exception as e:
            logger.warning("DynamoDB put failed: %s", e)

    _availability_cache[str(donor_id)] = item


def get_available_donors_by_blood_group(blood_group: str) -> list[dict]:
    """Fast lookup of available donors by blood group."""
    db = _get_dynamodb()
    if db:
        try:
            from boto3.dynamodb.conditions import Attr
            table = db.Table("bw-donor-availability")
            response = table.scan(
                FilterExpression=Attr("blood_group").eq(blood_group) & Attr("status").eq("available")
            )
            return response.get("Items", [])
        except Exception as e:
            logger.warning("DynamoDB scan failed: %s", e)

    # Local fallback
    return [v for v in _availability_cache.values()
            if v.get("blood_group") == blood_group and v.get("status") == "available"]


# ─── Table: bw-conversations ──────────────────────────────────────────────────

def add_conversation_turn(donor_id: int, role: str, content: str) -> None:
    """Store a conversation turn for Bedrock context window."""
    key = str(donor_id)
    turn = {"role": role, "content": content, "at": datetime.utcnow().isoformat()}

    if key not in _conversation_cache:
        _conversation_cache[key] = []
    _conversation_cache[key].append(turn)

    # Keep last 20 turns only
    _conversation_cache[key] = _conversation_cache[key][-20:]

    db = _get_dynamodb()
    if db:
        try:
            table = db.Table("bw-conversations")
            table.put_item(Item={
                "donor_id": key,
                "history": json.dumps(_conversation_cache[key]),
                "updated_at": datetime.utcnow().isoformat(),
                "ttl": int((datetime.utcnow() + timedelta(days=7)).timestamp()),
            })
        except Exception as e:
            logger.warning("DynamoDB conversation write failed: %s", e)


def get_conversation_history(donor_id: int) -> list[dict]:
    """Retrieve conversation history for Bedrock context."""
    key = str(donor_id)
    db = _get_dynamodb()
    if db:
        try:
            table = db.Table("bw-conversations")
            response = table.get_item(Key={"donor_id": key})
            item = response.get("Item", {})
            if item:
                return json.loads(item.get("history", "[]"))
        except Exception as e:
            logger.warning("DynamoDB conversation read failed: %s", e)

    return _conversation_cache.get(key, [])


# ─── Table: bw-pipeline-runs ──────────────────────────────────────────────────

def record_pipeline_run(run_data: dict) -> None:
    """Store pipeline run result for history/analytics."""
    record = {**run_data, "pk": f"run-{datetime.utcnow().isoformat()}"}
    _pipeline_runs.append(record)
    if len(_pipeline_runs) > 100:
        _pipeline_runs.pop(0)

    db = _get_dynamodb()
    if db:
        try:
            table = db.Table("bw-pipeline-runs")
            table.put_item(Item={
                "run_id": record["pk"],
                "data": json.dumps(run_data),
                "created_at": datetime.utcnow().isoformat(),
                "ttl": int((datetime.utcnow() + timedelta(days=30)).timestamp()),
            })
        except Exception as e:
            logger.warning("DynamoDB pipeline run write failed: %s", e)


def get_pipeline_run_history(limit: int = 20) -> list[dict]:
    """Get recent pipeline run history."""
    return list(reversed(_pipeline_runs))[:limit]


def get_dynamodb_status() -> dict:
    return {
        "available": DYNAMODB_AVAILABLE,
        "cached_donors": len(_availability_cache),
        "active_conversations": len(_conversation_cache),
        "pipeline_runs_stored": len(_pipeline_runs),
        "region": os.environ.get("AWS_REGION", "ap-south-1"),
    }

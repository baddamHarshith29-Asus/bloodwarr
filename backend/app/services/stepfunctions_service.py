"""
AWS Step Functions Service — Layer 4 (Orchestration Layer)
==========================================================
Manages Step Functions connectivity, execution history, and manual execution triggers.
Falls back to local thread-based scheduling when boto3 is unavailable.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

_sf_client = None
SF_AVAILABLE = False
STATE_MACHINE_ARN = os.environ.get("STATE_MACHINE_ARN", "arn:aws:states:ap-south-1:123456789012:stateMachine:BloodWarriorsOrchestrator")


def _get_sf_client():
    global _sf_client, SF_AVAILABLE
    if _sf_client is not None:
        return _sf_client
    try:
        import boto3
        session = boto3.Session()
        credentials = session.get_credentials()
        if not credentials:
            raise ValueError("No AWS credentials found in local environment")
            
        region = os.environ.get("AWS_REGION", "ap-south-1")
        _sf_client = boto3.client("stepfunctions", region_name=region)
        # Check by listing state machines
        _sf_client.list_state_machines(maxResults=1)
        SF_AVAILABLE = True
        logger.info("✅ AWS Step Functions client connected")
    except Exception as e:
        logger.warning("⚠️  AWS Step Functions unavailable — using local dev orchestrator: %s", e)
        SF_AVAILABLE = False
        _sf_client = None
    return _sf_client



def get_step_functions_status() -> dict:
    """Return Step Functions connection and state machine details."""
    client = _get_sf_client()
    return {
        "available": SF_AVAILABLE,
        "state_machine_arn": STATE_MACHINE_ARN,
        "region": os.environ.get("AWS_REGION", "ap-south-1"),
        "orchestration_mode": "Step Functions (AWS Serverless)" if SF_AVAILABLE else "Local Background Thread",
    }


def trigger_state_machine_execution(input_data: dict) -> dict:
    """Trigger a state machine run in AWS Step Functions."""
    client = _get_sf_client()
    if client:
        try:
            import json
            execution_name = f"run-{datetime.utcnow().strftime('%Y%m%dT%H%M%S')}"
            response = client.start_execution(
                stateMachineArn=STATE_MACHINE_ARN,
                name=execution_name,
                input=json.dumps(input_data)
            )
            return {
                "triggered": True,
                "execution_arn": response["executionArn"],
                "start_date": response["startDate"].isoformat(),
            }
        except Exception as e:
            logger.error("Failed to start Step Functions execution: %s", e)
            return {"triggered": False, "error": str(e)}
    return {"triggered": False, "note": "AWS Step Functions offline, ran locally."}

import os
import zipfile
import shutil

# Paths
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lambda_src_dir = os.path.join(base_dir, "infrastructure", "lambda_src")

# Ensure directory exists
os.makedirs(lambda_src_dir, exist_ok=True)

handler_code = """import os
import json
import urllib.request
import urllib.error
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

API_BASE_URL = os.environ.get("API_BASE_URL", "")

def lambda_handler(event, context):
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Extract request details if present
    request_id = event.get("request_id")
    if not request_id and "validation" in event:
        request_id = event.get("validation", {}).get("request_id")
    
    # Check function name or contextual variables to decide what endpoint to call
    function_name = os.environ.get("AWS_LAMBDA_FUNCTION_NAME", "")
    logger.info(f"Executing lambda: {function_name}")
    
    if "pipeline-trigger" in function_name:
        logger.info("Pipeline trigger invoked")
        url = f"{API_BASE_URL}/predictions/run"
        return make_post_request(url, {})
        
    elif "match-donors" in function_name:
        if event.get("patient_id") and not event.get("blood_group"):
            # ValidateRequest step
            patient_id = event.get("patient_id")
            url = f"{API_BASE_URL}/patients/{patient_id}"
            try:
                res = make_get_request(url)
                return {"valid": True, "request_id": request_id, "patient_id": patient_id}
            except Exception:
                return {"valid": False, "request_id": request_id, "patient_id": patient_id}
        else:
            # MatchDonors or EscalateRequest or MarkCritical
            url = f"{API_BASE_URL}/requests/{request_id}/match"
            res = make_post_request(url, {})
            matches = res.get("matches", [])
            return {
                "match_count": len(matches),
                "matches": matches,
                "request_id": request_id,
                "round": event.get("escalation", {}).get("round", 1) if "escalation" in event else 1
            }
            
    elif "generate-outreach" in function_name:
        url = f"{API_BASE_URL}/requests/{request_id}/outreach"
        res = make_post_request(url, {})
        return {
            "messages": res.get("notifications", []),
            "request_id": request_id
        }
        
    elif "send-notifications" in function_name:
        url = f"{API_BASE_URL}/requests/{request_id}/approve"
        res = make_post_request(url, {})
        return {
            "status": "notifications_sent",
            "request_id": request_id
        }
        
    elif "donor-response-webhook" in function_name:
        url = f"{API_BASE_URL}/requests/{request_id}/outreach"
        res = make_get_request(url)
        notifications = res.get("notifications", [])
        confirmed_donor_id = None
        status = "pending"
        for n in notifications:
            if n.get("status") == "responded" and n.get("donor_response", "").lower() in ("yes", "available", "confirmed"):
                status = "confirmed"
                confirmed_donor_id = n.get("donor_id")
                break
            elif n.get("status") == "declined":
                status = "declined"
        
        return {
            "status": status,
            "confirmed_donor_id": confirmed_donor_id,
            "request_id": request_id
        }
        
    elif "schedule-appointment" in function_name:
        return {
            "scheduled": True,
            "request_id": request_id
        }
        
    elif "send-reminder" in function_name:
        return {
            "reminder_sent": True,
            "request_id": request_id
        }
        
    elif "complete-donation" in function_name:
        url = f"{API_BASE_URL}/requests/{request_id}/complete"
        res = make_post_request(url, {})
        return {
            "status": "Completed",
            "request_id": request_id
        }
        
    else:
        logger.warning(f"Unknown function name: {function_name}")
        return {"status": "ok", "event": event}

def make_post_request(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode("utf-8")
            return json.loads(res_data)
    except urllib.error.HTTPError as e:
        logger.error(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")
        raise
    except Exception as e:
        logger.error(f"Error making POST request: {e}")
        raise

def make_get_request(url):
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode("utf-8")
            return json.loads(res_data)
    except urllib.error.HTTPError as e:
        logger.error(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")
        raise
    except Exception as e:
        logger.error(f"Error making GET request: {e}")
        raise
"""

# Write code to a temporary python file
temp_file = os.path.join(lambda_src_dir, "handler.py")
with open(temp_file, "w") as f:
    f.write(handler_code)

# List of zips to create
zip_names = [
    "match_donors.zip",
    "generate_outreach.zip",
    "send_notifications.zip",
    "donor_response_webhook.zip",
    "schedule_appointment.zip",
    "send_reminder.zip",
    "complete_donation.zip",
    "pipeline_trigger.zip"
]

for zip_name in zip_names:
    zip_path = os.path.join(lambda_src_dir, zip_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        zipf.write(temp_file, arcname="handler.py")
    print(f"Created {zip_name} in {lambda_src_dir}")

# Remove the temporary handler.py file
os.remove(temp_file)
print("Finished packaging all Lambdas!")

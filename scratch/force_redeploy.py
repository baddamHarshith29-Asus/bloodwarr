import boto3
import time
from datetime import datetime

client = boto3.client("ecs", region_name="ap-south-1")
cluster = "bloodwarriors-cluster"
service = "bloodwarriors-backend"

print("Forcing new ECS deployment...")
resp = client.update_service(
    cluster=cluster,
    service=service,
    forceNewDeployment=True
)

print("Service update triggered. Polling events to confirm new task starts...")
start_time = datetime.now()

while True:
    time.sleep(10)
    desc = client.describe_services(cluster=cluster, services=[service])["services"][0]
    
    # Print deployment status
    print(f"\nTime: {datetime.now().strftime('%H:%M:%S')}")
    for dep in desc.get("deployments", []):
        print(f"  Deployment {dep['id']} ({dep['status']}): running={dep['runningCount']}, pending={dep['pendingCount']}")
    
    # Print recent events
    events = desc.get("events", [])
    new_events = [e for e in events if (datetime.now() - e['createdAt'].replace(tzinfo=None)).total_seconds() < 60]
    for e in new_events:
        print(f"    Event: {e['message']}")
        
    # Check if a new PRIMARY deployment is running and stable
    primary_dep = next((d for d in desc.get("deployments", []) if d["status"] == "PRIMARY"), None)
    if primary_dep and primary_dep["runningCount"] == 1 and primary_dep["pendingCount"] == 0:
        # Check if the active running task ARN has changed
        tasks = client.list_tasks(cluster=cluster, serviceName=service)["taskArns"]
        if tasks:
            task_desc = client.describe_tasks(cluster=cluster, tasks=tasks)["tasks"][0]
            # Verify it's a new task started recently
            started_at = task_desc.get("startedAt")
            if started_at:
                seconds_ago = (datetime.now() - started_at.replace(tzinfo=None)).total_seconds()
                if seconds_ago < 120:
                    print("New task is running and stable!")
                    break
                else:
                    print(f"Task is still the old one (started {seconds_ago:.0f}s ago). Waiting...")
            else:
                print("Task is not started yet. Waiting...")
        else:
            print("No tasks found. Waiting...")
            
    if (datetime.now() - start_time).total_seconds() > 300:
        print("Timeout waiting for redeployment.")
        break

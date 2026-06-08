import sys
import boto3

sys.stdout.reconfigure(encoding='utf-8')
client = boto3.client("logs", region_name="ap-south-1")

log_group = "/ecs/bloodwarriors-backend"
stream_name = "ecs/backend/32aa153d314744f493c84b4a69c0fa85"

print(f"Filtering logs for {stream_name}...")
try:
    events = client.get_log_events(
        logGroupName=log_group,
        logStreamName=stream_name,
        limit=1000
    )["events"]
    for evt in events:
        msg = evt['message']
        if "⚠️" in msg or "unavailable" in msg or "failed" in msg or "exception" in msg or "Error" in msg:
            print(f"  {msg}")
except Exception as e:
    print("Failed to read log events:", e)

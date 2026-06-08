import sys
import boto3

sys.stdout.reconfigure(encoding='utf-8')
client = boto3.client("logs", region_name="ap-south-1")

log_group = "/ecs/bloodwarriors-backend"
stream_name = "ecs/backend/32aa153d314744f493c84b4a69c0fa85"

print(f"Reading ALL logs for {stream_name}...")
try:
    events = client.get_log_events(
        logGroupName=log_group,
        logStreamName=stream_name,
        limit=200
    )["events"]
    for evt in events:
        print(f"  {evt['message']}")
except Exception as e:
    print("Failed to read log events:", e)

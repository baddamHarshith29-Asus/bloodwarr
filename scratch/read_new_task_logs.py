import sys
import boto3

sys.stdout.reconfigure(encoding='utf-8')
client = boto3.client("logs", region_name="ap-south-1")

log_group = "/ecs/bloodwarriors-backend"
stream_name = "ecs/backend/c69eacdf50874e4aaabf976737714079"

print(f"Reading logs for {stream_name}...")
try:
    events = client.get_log_events(
        logGroupName=log_group,
        logStreamName=stream_name,
        limit=100
    )["events"]
    for evt in events:
        print(f"  {evt['message']}")
except Exception as e:
    print("Failed to read log events:", e)

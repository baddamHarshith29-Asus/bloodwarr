import sys
import boto3

# Set stdout to use utf-8 to avoid encoding errors
sys.stdout.reconfigure(encoding='utf-8')

client = boto3.client("logs", region_name="ap-south-1")

log_group = "/ecs/bloodwarriors-backend"
print(f"Describing log streams in group: {log_group}")
try:
    streams = client.describe_log_streams(
        logGroupName=log_group,
        orderBy="LastEventTime",
        descending=True,
        limit=5
    )["logStreams"]
    
    for stream in streams:
        stream_name = stream["logStreamName"]
        print(f"\nStream: {stream_name}")
        events = client.get_log_events(
            logGroupName=log_group,
            logStreamName=stream_name,
            limit=50
        )["events"]
        for evt in events:
            print(f"  {evt['message']}")
except Exception as e:
    print("Failed to read CloudWatch logs:", e)

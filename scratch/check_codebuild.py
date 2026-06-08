import sys
import boto3

sys.stdout.reconfigure(encoding='utf-8')

client = boto3.client("codebuild", region_name="ap-south-1")
logs_client = boto3.client("logs", region_name="ap-south-1")

build_id = "bw-backend-build:0eacb631-8653-4658-adb0-ed93381b99c7"
print(f"Describing build: {build_id}")
try:
    build_info = client.batch_get_builds(ids=[build_id])["builds"][0]
    print(f"Build Status: {build_info['buildStatus']}")
    logs = build_info.get("logs", {})
    group = logs.get("groupName")
    stream = logs.get("streamName")
    print(f"Log Group: {group}")
    print(f"Log Stream: {stream}")
    
    if group and stream:
        print("\nFetching logs...")
        events = logs_client.get_log_events(
            logGroupName=group,
            logStreamName=stream,
            limit=100
        )["events"]
        for evt in events:
            print(f"  {evt['message']}")
except Exception as e:
    print("Failed to get CodeBuild info:", e)

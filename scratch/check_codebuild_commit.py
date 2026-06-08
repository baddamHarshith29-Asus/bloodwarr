import boto3

client = boto3.client("codebuild", region_name="ap-south-1")
logs_client = boto3.client("logs", region_name="ap-south-1")

build_id = "bw-backend-build:0eacb631-8653-4658-adb0-ed93381b99c7"
try:
    build_info = client.batch_get_builds(ids=[build_id])["builds"][0]
    print("Source Version (Requested):", build_info.get("sourceVersion"))
    print("Resolved Source Version:", build_info.get("resolvedSourceVersion"))
    
    logs = build_info.get("logs", {})
    group = logs.get("groupName")
    stream = logs.get("streamName")
    
    if group and stream:
        print("\nCheckout Logs:")
        events = logs_client.get_log_events(
            logGroupName=group,
            logStreamName=stream,
            limit=25,
            startFromHead=True
        )["events"]
        for evt in events:
            print(f"  {evt['message']}")
except Exception as e:
    print("Error:", e)

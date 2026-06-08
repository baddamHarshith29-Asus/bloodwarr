import boto3

client = boto3.client("codebuild", region_name="ap-south-1")
project_name = "bw-backend-build"

print("Listing builds...")
try:
    builds = client.list_builds_for_project(projectName=project_name)["ids"]
    if builds:
        latest_ids = builds[:3]
        desc = client.batch_get_builds(ids=latest_ids)["builds"]
        for b in desc:
            print(f"Build ID: {b['id']}")
            print(f"  Status: {b['buildStatus']}")
            print(f"  Source: {b.get('sourceVersion')}")
            print(f"  Resolved: {b.get('resolvedSourceVersion')}")
            print(f"  Created: {b['startTime']}")
            print(f"  Ended: {b.get('endTime')}")
    else:
        print("No builds found.")
except Exception as e:
    print("Error listing builds:", e)

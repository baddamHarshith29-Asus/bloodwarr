import boto3

client = boto3.client("ecs", region_name="ap-south-1")
cluster = "bloodwarriors-cluster"
service = "bloodwarriors-backend"

desc = client.describe_services(cluster=cluster, services=[service])["services"][0]
print("Service Name:", desc["serviceName"])
print("Active Deployments:")
for dep in desc.get("deployments", []):
    print(f"  ID: {dep['id']}")
    print(f"    Status: {dep['status']}")
    print(f"    Task Definition: {dep['taskDefinition']}")
    print(f"    Desired Count: {dep['desiredCount']}")
    print(f"    Pending Count: {dep['pendingCount']}")
    print(f"    Running Count: {dep['runningCount']}")

print("\nRecent Service Events:")
for evt in desc.get("events", [])[:10]:
    print(f"  [{evt['createdAt']}] {evt['message']}")

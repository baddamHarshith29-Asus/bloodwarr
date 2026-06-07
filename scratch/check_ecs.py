import boto3
import json

client = boto3.client("ecs", region_name="ap-south-1")

print("Listing ECS Clusters...")
clusters = client.list_clusters()["clusterArns"]
print("Clusters:", clusters)

for cluster in clusters:
    print(f"\nCluster: {cluster}")
    services = client.list_services(cluster=cluster)["serviceArns"]
    print("  Services:", services)
    
    for service in services:
        desc = client.describe_services(cluster=cluster, services=[service])["services"][0]
        print(f"    Service Name: {desc['serviceName']}")
        print(f"    Task Definition: {desc['taskDefinition']}")
        
        # Describe task definition
        task_def = client.describe_task_definition(taskDefinition=desc['taskDefinition'])["taskDefinition"]
        print(f"    Task Role ARN: {task_def.get('taskRoleArn')}")
        print(f"    Execution Role ARN: {task_def.get('executionRoleArn')}")
        
        # Show container environment variables
        container = task_def["containerDefinitions"][0]
        print(f"    Container Name: {container['name']}")
        print(f"    Image: {container['image']}")
        print("    Environment Variables:")
        for env in container.get("environment", []):
            print(f"      {env['name']} = {env['value']}")

import boto3

client = boto3.client("ecs", region_name="ap-south-1")
cluster = "bloodwarriors-cluster"
service = "bloodwarriors-backend"

tasks_resp = client.list_tasks(cluster=cluster, serviceName=service)
task_arns = tasks_resp["taskArns"]
print("Active task ARNs in service:", task_arns)

if task_arns:
    desc_resp = client.describe_tasks(cluster=cluster, tasks=task_arns)
    for task in desc_resp["tasks"]:
        print(f"\nTask ARN: {task['taskArn']}")
        print(f"  Last Status: {task['lastStatus']}")
        print(f"  Desired Status: {task['desiredStatus']}")
        print(f"  Task Definition: {task['taskDefinitionArn']}")
        print(f"  Health Status: {task.get('healthStatus')}")
        print(f"  Started At: {task.get('startedAt')}")
        print(f"  Pull Started At: {task.get('pullStartedAt')}")

import boto3
import time

cb_client = boto3.client("codebuild", region_name="ap-south-1")
ecs_client = boto3.client("ecs", region_name="ap-south-1")

project_name = "bw-backend-build"
cluster_name = "bloodwarriors-cluster"
service_name = "bloodwarriors-backend"

print(f"Starting AWS CodeBuild build for project: {project_name}")
try:
    build_resp = cb_client.start_build(projectName=project_name)
    build_id = build_resp["build"]["id"]
    print(f"Build started successfully. Build ID: {build_id}")
    
    # Poll build status
    while True:
        time.sleep(15)
        build_info = cb_client.batch_get_builds(ids=[build_id])["builds"][0]
        status = build_info["buildStatus"]
        print(f"Current build status: {status}")
        
        if status in ["SUCCEEDED", "FAILED", "FAULT", "TIMED_OUT", "STOPPED"]:
            if status == "SUCCEEDED":
                print("CodeBuild execution completed successfully!")
                break
            else:
                raise RuntimeError(f"CodeBuild execution failed with status: {status}")
except Exception as e:
    print("CodeBuild execution error:", e)
    exit(1)

print("\nForcing new deployment on ECS Fargate to apply latest image...")
try:
    ecs_client.update_service(
        cluster=cluster_name,
        service=service_name,
        forceNewDeployment=True
    )
    print("ECS Service update triggered. Waiting for tasks to stabilize...")
    
    # Wait for the service to stabilize
    waiter = ecs_client.get_waiter("services_stable")
    waiter.wait(cluster=cluster_name, services=[service_name])
    print("ECS Fargate redeployment completed successfully!")
except Exception as e:
    print("ECS redeployment error:", e)
    exit(1)

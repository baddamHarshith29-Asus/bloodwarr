import boto3

client = boto3.client("ecr", region_name="ap-south-1")
repo = "bloodwarriors/backend"

print(f"Listing ECR images for repo: {repo}")
try:
    images = client.describe_images(repositoryName=repo)["imageDetails"]
    # Sort by push time descending
    images.sort(key=lambda x: x["imagePushedAt"], reverse=True)
    
    for img in images[:5]:
        print(f"\nImage Digest: {img['imageDigest']}")
        print(f"  Tags: {img.get('imageTags', [])}")
        print(f"  Pushed At: {img['imagePushedAt']}")
        print(f"  Size: {img['imageSizeInBytes']} bytes")
except Exception as e:
    print("Failed to describe ECR images:", e)

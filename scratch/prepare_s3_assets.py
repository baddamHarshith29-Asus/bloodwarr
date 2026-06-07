import os
import tarfile
import time
import boto3
import botocore.exceptions

bucket_name = "bloodwarriors-datalake-prod"
s3_key = "models/donor_matching_model.tar.gz"

# 1. Create a dummy model tarball
temp_dir = os.path.dirname(os.path.abspath(__file__))
tar_path = os.path.join(temp_dir, "donor_matching_model.tar.gz")

# Create a mock model file and inference script
model_file = os.path.join(temp_dir, "model.joblib")
with open(model_file, "w") as f:
    f.write("mock_model_data")

inference_file = os.path.join(temp_dir, "inference.py")
with open(inference_file, "w") as f:
    f.write("""
def model_fn(model_dir):
    return "mock_model"
def predict_fn(input_data, model):
    return [1, 2, 3, 4, 5]
""")

# Package into tar.gz
with tarfile.open(tar_path, "w:gz") as tar:
    tar.add(model_file, arcname="model.joblib")
    tar.add(inference_file, arcname="code/inference.py")

# Clean up local temporary files
os.remove(model_file)
os.remove(inference_file)
print(f"Created local dummy tarball at: {tar_path}")

# 2. Poll S3 bucket existence and upload
s3 = boto3.client("s3", region_name="ap-south-1")

print(f"Waiting for S3 bucket '{bucket_name}' to be created by Terraform...")
retries = 60
bucket_found = False
for i in range(retries):
    try:
        s3.head_bucket(Bucket=bucket_name)
        bucket_found = True
        print(f"Bucket '{bucket_name}' found!")
        break
    except botocore.exceptions.ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            time.sleep(5)
        else:
            # Handle unauthorized or other errors by creating the bucket ourselves
            print(f"Got error {error_code}, trying to create bucket ourselves...")
            try:
                s3.create_bucket(
                    Bucket=bucket_name,
                    CreateBucketConfiguration={'LocationConstraint': 'ap-south-1'}
                )
                bucket_found = True
                print(f"Created bucket '{bucket_name}' successfully!")
                break
            except Exception as create_err:
                print(f"Failed to create bucket: {create_err}")
                time.sleep(5)

if bucket_found:
    print(f"Uploading mock SageMaker model to s3://{bucket_name}/{s3_key}...")
    try:
        s3.upload_file(tar_path, bucket_name, s3_key)
        print("Upload complete!")
    except Exception as e:
        print(f"Upload failed: {e}")
else:
    print("Bucket was not created within the timeout period.")

# Clean up local tarball
if os.path.exists(tar_path):
    os.remove(tar_path)

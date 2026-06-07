import boto3
import os

print("AWS_REGION:", os.environ.get("AWS_REGION", "ap-south-1"))

try:
    session = boto3.Session()
    credentials = session.get_credentials()
    if not credentials:
        print("Error: No credentials returned by boto3 Session")
    else:
        print("Credentials found:")
        print("  Access Key:", credentials.access_key)
except Exception as e:
    print("Session credentials check failed:", e)

# Test Bedrock
try:
    bedrock = boto3.client("bedrock-runtime", region_name="ap-south-1")
    print("Bedrock client initialized successfully.")
    # Attempt to list models or invoke a simple query
    # We won't call invoke_model yet to avoid charges if credentials fail
except Exception as e:
    print("Bedrock initialization failed:", e)

# Test DynamoDB
try:
    dynamodb = boto3.client("dynamodb", region_name="ap-south-1")
    tables = dynamodb.list_tables()["TableNames"]
    print("DynamoDB connected successfully. Deployed tables:", tables)
except Exception as e:
    print("DynamoDB list_tables failed:", e)

# Test Kinesis
try:
    kinesis = boto3.client("kinesis", region_name="ap-south-1")
    streams = kinesis.list_streams()["StreamNames"]
    print("Kinesis connected successfully. Streams:", streams)
except Exception as e:
    print("Kinesis list_streams failed:", e)

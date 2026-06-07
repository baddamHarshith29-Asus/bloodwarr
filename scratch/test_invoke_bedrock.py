import boto3
import json

print("Initializing Bedrock runtime client...")
try:
    client = boto3.client("bedrock-runtime", region_name="ap-south-1")
    
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 100,
        "temperature": 0.5,
        "messages": [
            {"role": "user", "content": "Hello Bedrock, reply with 'Hello World'"}
        ]
    })
    
    print("Invoking Claude 3 Haiku...")
    response = client.invoke_model(
        modelId="anthropic.claude-3-haiku-20240307-v1:0",
        body=body,
        contentType="application/json",
        accept="application/json",
    )
    
    result = json.loads(response["body"].read())
    text = result["content"][0]["text"].strip()
    print("Invocation successful! Response:")
    print(text)
except Exception as e:
    print("Bedrock invocation failed:")
    print(e)

###############################################################################
# IAM Roles for Blood Warriors AWS Services
###############################################################################

# ── ECS Task Execution Role ───────────────────────────────────────────────────
resource "aws_iam_role" "ecs_execution" {
  name = "bw-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ── ECS Task Role (app permissions) ──────────────────────────────────────────
resource "aws_iam_role" "ecs_task" {
  name = "bw-ecs-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "bw-ecs-task-policy"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Bedrock — Claude access
      { Effect = "Allow", Action = ["bedrock:InvokeModel", "bedrock:ListFoundationModels"], Resource = "*" },
      # Kinesis
      { Effect = "Allow", Action = ["kinesis:PutRecord", "kinesis:PutRecords", "kinesis:DescribeStream"], Resource = [aws_kinesis_stream.events.arn, aws_kinesis_stream.outreach.arn] },
      # DynamoDB
      { Effect = "Allow", Action = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:UpdateItem"],
        Resource = [aws_dynamodb_table.donor_availability.arn, aws_dynamodb_table.conversations.arn, aws_dynamodb_table.pipeline_runs.arn] },
      # SNS
      { Effect = "Allow", Action = ["sns:Publish"], Resource = [aws_sns_topic.blood_alerts.arn, aws_sns_topic.donor_outreach.arn] },
      # SQS
      { Effect = "Allow", Action = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage"], Resource = aws_sqs_queue.outreach_queue.arn },
      # SES
      { Effect = "Allow", Action = ["ses:SendEmail", "ses:SendRawEmail"], Resource = "*" },
      # SageMaker
      { Effect = "Allow", Action = ["sagemaker:InvokeEndpoint"], Resource = aws_sagemaker_endpoint.matching.arn },
      # Step Functions
      { Effect = "Allow", Action = ["states:StartExecution", "states:DescribeExecution"], Resource = "*" },
      # CloudWatch
      { Effect = "Allow", Action = ["cloudwatch:PutMetricData", "logs:CreateLogGroup", "logs:PutLogEvents"], Resource = "*" },
    ]
  })
}

# ── Lambda Role ───────────────────────────────────────────────────────────────
resource "aws_iam_role" "lambda" {
  name = "bw-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "bw-lambda-policy"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = "*" },
      { Effect = "Allow", Action = ["kinesis:PutRecord", "kinesis:GetRecords", "kinesis:GetShardIterator"], Resource = [aws_kinesis_stream.events.arn] },
      { Effect = "Allow", Action = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:Scan"], Resource = "*" },
      { Effect = "Allow", Action = ["sns:Publish"], Resource = "*" },
      { Effect = "Allow", Action = ["ses:SendEmail"], Resource = "*" },
      { Effect = "Allow", Action = ["sagemaker:InvokeEndpoint"], Resource = "*" },
      { Effect = "Allow", Action = ["states:StartExecution"], Resource = "*" },
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "*" },
    ]
  })
}

# ── Step Functions Role ────────────────────────────────────────────────────────
resource "aws_iam_role" "step_functions" {
  name = "bw-step-functions-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "states.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "step_functions_policy" {
  name = "bw-step-functions-policy"
  role = aws_iam_role.step_functions.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = "*" },
      { Effect = "Allow", Action = ["kinesis:PutRecord"], Resource = aws_kinesis_stream.events.arn },
      { Effect = "Allow", Action = ["dynamodb:PutItem", "dynamodb:UpdateItem"], Resource = "*" },
      { Effect = "Allow", Action = [
        "logs:CreateLogDelivery",
        "logs:GetLogDelivery",
        "logs:UpdateLogDelivery",
        "logs:DeleteLogDelivery",
        "logs:ListLogDeliveries",
        "logs:PutLogEvents",
        "logs:GetLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:DescribeResourcePolicies",
        "logs:PutResourcePolicy"
      ], Resource = "*" },
      { Effect = "Allow", Action = ["xray:PutTraceSegments", "xray:GetSamplingRules"], Resource = "*" },
    ]
  })
}

# ── Glue Role ─────────────────────────────────────────────────────────────────
resource "aws_iam_role" "glue" {
  name = "bw-glue-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "glue.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "glue_service" {
  role       = aws_iam_role.glue.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
}

resource "aws_iam_role_policy" "glue_s3" {
  name = "bw-glue-s3-policy"
  role = aws_iam_role.glue.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = ["s3:*"], Resource = ["${aws_s3_bucket.data_lake.arn}", "${aws_s3_bucket.data_lake.arn}/*"] }]
  })
}

# ── SageMaker Role ─────────────────────────────────────────────────────────────
resource "aws_iam_role" "sagemaker" {
  name = "bw-sagemaker-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "sagemaker.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "sagemaker_full" {
  role       = aws_iam_role.sagemaker.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
}

resource "aws_iam_role_policy" "sagemaker_s3" {
  name = "bw-sagemaker-s3"
  role = aws_iam_role.sagemaker.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = "${aws_s3_bucket.data_lake.arn}/*" }]
  })
}

# ── CodePipeline Role ──────────────────────────────────────────────────────────
resource "aws_iam_role" "codepipeline" {
  name = "bw-codepipeline-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "codepipeline.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "codepipeline_policy" {
  role       = aws_iam_role.codepipeline.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

# ── CodeBuild Role ─────────────────────────────────────────────────────────────
resource "aws_iam_role" "codebuild" {
  name = "bw-codebuild-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "codebuild.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "codebuild_policy" {
  role       = aws_iam_role.codebuild.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

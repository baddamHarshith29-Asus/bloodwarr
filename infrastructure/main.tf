###############################################################################
# Blood Warriors — Full AWS Tech Stack (Terraform)
# Implements all 5 layers from the recommended tech stack diagram:
#
# Layer 1: ECS Fargate (FastAPI) + S3/CloudFront (React)
# Layer 2: Aurora PostgreSQL + DynamoDB + S3 Data Lake + Glue + Kinesis
# Layer 3: Amazon Bedrock (Claude) + SageMaker (Matching Model)
# Layer 4: Step Functions + Lambda + API Gateway
# Layer 5: ECS/EC2 + CodePipeline + CloudWatch
###############################################################################

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws  = { source = "hashicorp/aws", version = "~> 5.0" }
    null = { source = "hashicorp/null", version = "~> 3.0" }
  }
  backend "s3" {
    bucket = "bloodwarriors-tfstate"
    key    = "prod/terraform.tfstate"
    region = "ap-south-1"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = { Project = "BloodWarriors", Environment = var.environment, ManagedBy = "Terraform" }
  }
}

###############################################################################
# LAYER 0: Networking
###############################################################################

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
  name    = "bloodwarriors-vpc"
  cidr    = "10.0.0.0/16"
  azs              = ["${var.aws_region}a", "${var.aws_region}b"]
  private_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets   = ["10.0.101.0/24", "10.0.102.0/24"]
  database_subnets = ["10.0.201.0/24", "10.0.202.0/24"]
  enable_nat_gateway     = true
  single_nat_gateway     = true
  enable_dns_hostnames   = true
  enable_dns_support     = true
  create_database_subnet_group = true
}

###############################################################################
# LAYER 2: DATA ENGINEERING — Aurora + DynamoDB + S3 + Kinesis + Glue
###############################################################################

# ── Aurora PostgreSQL (production DB) ───────────────────────────────────────
resource "aws_security_group" "aurora" {
  name   = "bw-aurora-sg"
  vpc_id = module.vpc.vpc_id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id, aws_security_group.lambda.id]
  }
}

resource "aws_rds_cluster" "aurora" {
  cluster_identifier      = "bloodwarriors-aurora"
  engine                  = "aurora-postgresql"
  engine_version          = "15.8"
  database_name           = "bloodwarriors"
  master_username         = var.db_username
  master_password         = var.db_password
  db_subnet_group_name    = module.vpc.database_subnet_group_name
  vpc_security_group_ids  = [aws_security_group.aurora.id]
  backup_retention_period = 7
  deletion_protection     = true
  storage_encrypted       = true
  skip_final_snapshot     = false
  enabled_cloudwatch_logs_exports = ["postgresql"]
}

resource "aws_rds_cluster_instance" "aurora_instance" {
  cluster_identifier = aws_rds_cluster.aurora.id
  instance_class     = "db.t3.medium"
  engine             = aws_rds_cluster.aurora.engine
  engine_version     = aws_rds_cluster.aurora.engine_version
}

# ── DynamoDB Tables ──────────────────────────────────────────────────────────
resource "aws_dynamodb_table" "donor_availability" {
  name           = "bw-donor-availability"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "donor_id"
  attribute {
    name = "donor_id"
    type = "S"
  }
  attribute {
    name = "blood_group"
    type = "S"
  }
  global_secondary_index {
    name            = "blood-group-index"
    hash_key        = "blood_group"
    projection_type = "ALL"
  }
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  tags = { Name = "bw-donor-availability" }
}

resource "aws_dynamodb_table" "conversations" {
  name         = "bw-conversations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "donor_id"
  attribute {
    name = "donor_id"
    type = "S"
  }
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  tags = { Name = "bw-conversations" }
}

resource "aws_dynamodb_table" "pipeline_runs" {
  name         = "bw-pipeline-runs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "run_id"
  attribute {
    name = "run_id"
    type = "S"
  }
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  tags = { Name = "bw-pipeline-runs" }
}

# ── S3 Data Lake ─────────────────────────────────────────────────────────────
resource "aws_s3_bucket" "data_lake" {
  bucket = "bloodwarriors-datalake-${var.environment}"
}

resource "aws_s3_bucket_versioning" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_lifecycle_configuration" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id
  rule {
    id     = "archive-old-data"
    status = "Enabled"
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    filter { prefix = "" }
  }
}

# ── Amazon Kinesis Data Streams ───────────────────────────────────────────────
resource "aws_kinesis_stream" "events" {
  name             = "blood-warriors-events"
  shard_count      = 1
  retention_period = 48
  stream_mode_details { stream_mode = "PROVISIONED" }
  tags = { Name = "blood-warriors-events" }
}

resource "aws_kinesis_stream" "outreach" {
  name             = "blood-warriors-outreach"
  shard_count      = 1
  retention_period = 24
  stream_mode_details { stream_mode = "PROVISIONED" }
}

# ── AWS Glue — ETL Pipeline ───────────────────────────────────────────────────
resource "aws_glue_catalog_database" "bloodwarriors" {
  name = "bloodwarriors_catalog"
}

resource "aws_glue_crawler" "donations" {
  name          = "bw-donations-crawler"
  role          = aws_iam_role.glue.arn
  database_name = aws_glue_catalog_database.bloodwarriors.name
  s3_target { path = "s3://${aws_s3_bucket.data_lake.bucket}/donations/" }
  schedule = "cron(0 2 * * ? *)"  # 2am daily
}

resource "aws_glue_job" "donor_etl" {
  name     = "bw-donor-pattern-etl"
  role_arn = aws_iam_role.glue.arn
  command {
    name            = "glueetl"
    script_location = "s3://${aws_s3_bucket.data_lake.bucket}/glue_scripts/donor_pattern_etl.py"
    python_version  = "3"
  }
  default_arguments = {
    "--job-language"         = "python"
    "--SOURCE_TABLE"         = "donor_history"
    "--TARGET_S3_PATH"       = "s3://${aws_s3_bucket.data_lake.bucket}/ml_features/"
    "--SAGEMAKER_BUCKET"     = aws_s3_bucket.data_lake.bucket
  }
  max_retries    = 1
  timeout        = 30
  glue_version   = "4.0"
  worker_type    = "G.1X"
  number_of_workers = 2
}

###############################################################################
# LAYER 3: AI/ML — Amazon Bedrock + SageMaker
###############################################################################

# Bedrock is a managed service — no infrastructure provisioning needed.
# IAM access is granted via task role policy below.
# Model used: anthropic.claude-3-haiku-20240307-v1:0

# ── SageMaker — Donor Matching Model ─────────────────────────────────────────
resource "aws_sagemaker_model" "matching" {
  name               = "bw-donor-matching-model"
  execution_role_arn = aws_iam_role.sagemaker.arn
  primary_container {
    image          = "720646828776.dkr.ecr.${var.aws_region}.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3"
    model_data_url = "s3://${aws_s3_bucket.data_lake.bucket}/models/donor_matching_model.tar.gz"
    environment = {
      SAGEMAKER_PROGRAM        = "inference.py"
      SAGEMAKER_SUBMIT_DIRECTORY = "/opt/ml/code"
    }
  }
}

resource "aws_sagemaker_endpoint_configuration" "matching" {
  name = "bw-donor-matching-config"
  production_variants {
    variant_name           = "AllTraffic"
    model_name             = aws_sagemaker_model.matching.name
    initial_instance_count = 1
    instance_type          = "ml.t2.medium"
  }
}

resource "aws_sagemaker_endpoint" "matching" {
  name                 = "bw-donor-matching-endpoint"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.matching.name
}

###############################################################################
# LAYER 4: ORCHESTRATION — Step Functions + Lambda + API Gateway
###############################################################################

# ── Lambda Functions ──────────────────────────────────────────────────────────
resource "aws_security_group" "lambda" {
  name   = "bw-lambda-sg"
  vpc_id = module.vpc.vpc_id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

locals {
  lambda_env = {
    DATABASE_URL             = "postgresql://${var.db_username}:${var.db_password}@${aws_rds_cluster.aurora.endpoint}/bloodwarriors"
    KINESIS_STREAM_NAME      = aws_kinesis_stream.events.name
    DYNAMODB_AVAILABILITY_TABLE = aws_dynamodb_table.donor_availability.name
    DYNAMODB_CONVERSATIONS_TABLE = aws_dynamodb_table.conversations.name
    SAGEMAKER_ENDPOINT       = aws_sagemaker_endpoint.matching.name
    SNS_ALERTS_ARN           = aws_sns_topic.blood_alerts.arn
    SES_FROM_EMAIL           = "noreply@${var.email_domain}"
    API_BASE_URL             = "http://${aws_lb.main.dns_name}/api/v1"
  }
}

# Lambda: Match Donors
resource "aws_lambda_function" "match_donors" {
  function_name = "bw-match-donors"
  role          = aws_iam_role.lambda.arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/lambda_src/match_donors.zip"
  timeout       = 60
  memory_size   = 512
  vpc_config {
    subnet_ids         = module.vpc.private_subnets
    security_group_ids = [aws_security_group.lambda.id]
  }
  environment { variables = local.lambda_env }
}

# Lambda: Generate Outreach (calls Bedrock)
resource "aws_lambda_function" "generate_outreach" {
  function_name = "bw-generate-outreach"
  role          = aws_iam_role.lambda.arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/lambda_src/generate_outreach.zip"
  timeout       = 120
  memory_size   = 256
  vpc_config {
    subnet_ids         = module.vpc.private_subnets
    security_group_ids = [aws_security_group.lambda.id]
  }
  environment { variables = local.lambda_env }
}

# Lambda: Send Notifications (SNS/SES/SQS)
resource "aws_lambda_function" "send_notifications" {
  function_name = "bw-send-notifications"
  role          = aws_iam_role.lambda.arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/lambda_src/send_notifications.zip"
  timeout       = 60
  memory_size   = 256
  environment { variables = local.lambda_env }
}

# Lambda: Donor Response Webhook (called by SNS/Twilio)
resource "aws_lambda_function" "donor_response_webhook" {
  function_name = "bw-donor-response-webhook"
  role          = aws_iam_role.lambda.arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/lambda_src/donor_response_webhook.zip"
  timeout       = 30
  memory_size   = 256
  environment { variables = local.lambda_env }
}

# Lambda: Schedule Appointment
resource "aws_lambda_function" "schedule_appointment" {
  function_name = "bw-schedule-appointment"
  role          = aws_iam_role.lambda.arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/lambda_src/schedule_appointment.zip"
  timeout       = 30
  memory_size   = 256
  environment { variables = local.lambda_env }
}

# Lambda: Send Reminder (Bedrock-personalized)
resource "aws_lambda_function" "send_reminder" {
  function_name = "bw-send-reminder"
  role          = aws_iam_role.lambda.arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/lambda_src/send_reminder.zip"
  timeout       = 60
  memory_size   = 256
  environment { variables = local.lambda_env }
}

# Lambda: Complete Donation (update donor stats, 90-day cooldown)
resource "aws_lambda_function" "complete_donation" {
  function_name = "bw-complete-donation"
  role          = aws_iam_role.lambda.arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/lambda_src/complete_donation.zip"
  timeout       = 30
  memory_size   = 256
  environment { variables = local.lambda_env }
}

# Lambda: Pipeline Trigger (EventBridge → Step Functions)
resource "aws_lambda_function" "pipeline_trigger" {
  function_name = "bw-pipeline-trigger"
  role          = aws_iam_role.lambda.arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/lambda_src/pipeline_trigger.zip"
  timeout       = 10
  memory_size   = 128
  environment {
    variables = merge(local.lambda_env, {
      STATE_MACHINE_ARN = aws_sfn_state_machine.blood_coordination.arn
    })
  }
}

# ── Step Functions State Machine ──────────────────────────────────────────────
resource "aws_sfn_state_machine" "blood_coordination" {
  name     = "bw-blood-coordination-pipeline"
  role_arn = aws_iam_role.step_functions.arn

  definition = templatefile("${path.module}/step_functions_definition.json", {
    ValidateRequestLambdaArn   = aws_lambda_function.match_donors.arn
    MatchDonorsLambdaArn       = aws_lambda_function.match_donors.arn
    GenerateOutreachLambdaArn  = aws_lambda_function.generate_outreach.arn
    SendNotificationsLambdaArn = aws_lambda_function.send_notifications.arn
    CheckResponseLambdaArn     = aws_lambda_function.donor_response_webhook.arn
    ScheduleAppointmentLambdaArn = aws_lambda_function.schedule_appointment.arn
    SendReminderLambdaArn      = aws_lambda_function.send_reminder.arn
    CompleteDonationLambdaArn  = aws_lambda_function.complete_donation.arn
    EscalateRequestLambdaArn   = aws_lambda_function.match_donors.arn
    MarkCriticalLambdaArn      = aws_lambda_function.match_donors.arn
    KinesisStreamName          = aws_kinesis_stream.events.name
  })

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.step_functions.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }
}

# ── EventBridge → Lambda → Step Functions (every 5 min) ──────────────────────
resource "aws_cloudwatch_event_rule" "pipeline_schedule" {
  name                = "bw-pipeline-trigger"
  description         = "Trigger Blood Warriors AI pipeline every 5 minutes"
  schedule_expression = "rate(5 minutes)"
  state               = "DISABLED"
}

resource "aws_cloudwatch_event_target" "pipeline_lambda" {
  rule      = aws_cloudwatch_event_rule.pipeline_schedule.name
  target_id = "PipelineLambda"
  arn       = aws_lambda_function.pipeline_trigger.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pipeline_trigger.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.pipeline_schedule.arn
}

# ── API Gateway (REST) ────────────────────────────────────────────────────────
resource "aws_api_gateway_rest_api" "bloodwarriors" {
  name        = "bloodwarriors-api"
  description = "Blood Warriors API Gateway — routes to ECS + Lambda"
  endpoint_configuration { types = ["REGIONAL"] }
}

resource "aws_api_gateway_resource" "webhook" {
  rest_api_id = aws_api_gateway_rest_api.bloodwarriors.id
  parent_id   = aws_api_gateway_rest_api.bloodwarriors.root_resource_id
  path_part   = "webhook"
}

resource "aws_api_gateway_method" "webhook_post" {
  rest_api_id   = aws_api_gateway_rest_api.bloodwarriors.id
  resource_id   = aws_api_gateway_resource.webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "webhook_lambda" {
  rest_api_id             = aws_api_gateway_rest_api.bloodwarriors.id
  resource_id             = aws_api_gateway_resource.webhook.id
  http_method             = aws_api_gateway_method.webhook_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.donor_response_webhook.invoke_arn
}

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.bloodwarriors.id
  depends_on  = [aws_api_gateway_integration.webhook_lambda]
  lifecycle   { create_before_destroy = true }
}

resource "aws_api_gateway_stage" "prod" {
  rest_api_id   = aws_api_gateway_rest_api.bloodwarriors.id
  deployment_id = aws_api_gateway_deployment.main.id
  stage_name    = "prod"
}

###############################################################################
# LAYER 1 + 5: ECS + ALB + S3/CloudFront + CodePipeline
###############################################################################

# ── ECR Repository ────────────────────────────────────────────────────────────
resource "aws_ecr_repository" "backend" {
  name                 = "bloodwarriors/backend"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

# ── ECS Cluster + Service ─────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "bloodwarriors-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_security_group" "ecs" {
  name   = "bw-ecs-sg"
  vpc_id = module.vpc.vpc_id
  ingress {
    from_port       = 8096
    to_port         = 8096
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "bloodwarriors-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "backend"
    image = "${aws_ecr_repository.backend.repository_url}:latest"
    portMappings = [{ containerPort = 8096 }]
    environment = [
      { name = "DATABASE_URL",             value = "postgresql://${var.db_username}:${var.db_password}@${aws_rds_cluster.aurora.endpoint}/bloodwarriors" },
      { name = "KINESIS_STREAM_NAME",      value = aws_kinesis_stream.events.name },
      { name = "SAGEMAKER_ENDPOINT",       value = aws_sagemaker_endpoint.matching.name },
      { name = "SES_FROM_EMAIL",           value = "noreply@${var.email_domain}" },
      { name = "AWS_REGION",               value = var.aws_region },
      { name = "STATE_MACHINE_ARN",        value = aws_sfn_state_machine.blood_coordination.arn },
      { name = "PIPELINE_INTERVAL_SECONDS", value = "300" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = "/ecs/bloodwarriors-backend"
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "backend" {
  name            = "bloodwarriors-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8096
  }
}

# ── ALB ───────────────────────────────────────────────────────────────────────
resource "aws_security_group" "alb" {
  name   = "bw-alb-sg"
  vpc_id = module.vpc.vpc_id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "main" {
  name               = "bloodwarriors-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets
}

resource "aws_lb_target_group" "backend" {
  name        = "bw-backend-tg"
  port        = 8096
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"
  health_check {
    path              = "/"
    interval          = 30
    healthy_threshold = 2
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# ── Frontend S3 + CloudFront ──────────────────────────────────────────────────
resource "aws_s3_bucket" "frontend" {
  bucket = "bloodwarriors-frontend-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "frontend_public_read" {
  bucket     = aws_s3_bucket.frontend.id
  depends_on = [aws_s3_bucket_public_access_block.frontend]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "S3Frontend"
  }

  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "FastAPIBackend"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3Frontend"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "FastAPIBackend"

    forwarded_values {
      query_string = true
      headers      = ["*"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# ── CodePipeline (CI/CD) ──────────────────────────────────────────────────────


resource "aws_codebuild_project" "backend" {
  name          = "bw-backend-build"
  service_role  = aws_iam_role.codebuild.arn
  build_timeout = "15"

  artifacts {
    type = "NO_ARTIFACTS"
    name = null
  }
  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true
    environment_variable {
      name  = "ECR_REPO"
      value = aws_ecr_repository.backend.repository_url
    }
    environment_variable {
      name  = "AWS_REGION"
      value = var.aws_region
    }
  }
  source {
    type            = "GITHUB"
    location        = "https://github.com/baddamHarshith29-Asus/bloodwarr.git"
    git_clone_depth = 1
    buildspec       = <<-EOT
      version: 0.2
      phases:
        pre_build:
          commands:
            - aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO
        build:
          commands:
            - cp Dataset.csv backend/
            - cd backend
            - docker build -t bloodwarriors-backend .
            - docker tag bloodwarriors-backend:latest $ECR_REPO:latest
        post_build:
          commands:
            - docker push $ECR_REPO:latest
    EOT
  }
}

###############################################################################
# SNS + SES + SQS
###############################################################################
resource "aws_sns_topic" "blood_alerts" {
  name         = "bloodwarriors-alerts"
  display_name = "Blood Warriors Alerts"
}

resource "aws_sns_topic" "donor_outreach" {
  name         = "bloodwarriors-donor-outreach"
  display_name = "Blood Warriors Donor Outreach"
}

resource "aws_sqs_queue" "outreach_queue" {
  name                        = "bloodwarriors-outreach.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 120
}

resource "aws_ses_domain_identity" "bloodwarriors" {
  domain = var.email_domain
}

###############################################################################
# CloudWatch — Logs + Alarms
###############################################################################
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/bloodwarriors-backend"
  retention_in_days = 30
}
resource "aws_cloudwatch_log_group" "step_functions" {
  name              = "/aws/states/bw-blood-coordination"
  retention_in_days = 14
}
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/bloodwarriors"
  retention_in_days = 7
}

resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "bw-ecs-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = [aws_sns_topic.blood_alerts.arn]
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }
}

resource "aws_cloudwatch_metric_alarm" "pipeline_failures" {
  alarm_name          = "bw-step-function-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ExecutionsFailed"
  namespace           = "AWS/States"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  alarm_actions       = [aws_sns_topic.blood_alerts.arn]
  dimensions          = { StateMachineArn = aws_sfn_state_machine.blood_coordination.arn }
}

###############################################################################
# DATA SOURCES
###############################################################################
data "aws_caller_identity" "current" {}

###############################################################################
# IMPORT BLOCKS FOR PRE-EXISTING RESOURCES
###############################################################################

import {
  to = aws_dynamodb_table.donor_availability
  id = "bw-donor-availability"
}

import {
  to = aws_dynamodb_table.conversations
  id = "bw-conversations"
}

import {
  to = aws_dynamodb_table.pipeline_runs
  id = "bw-pipeline-runs"
}

import {
  to = aws_kinesis_stream.events
  id = "blood-warriors-events"
}

import {
  to = aws_sagemaker_endpoint.matching
  id = "bw-donor-matching-endpoint"
}


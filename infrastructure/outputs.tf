output "frontend_url" {
  description = "CloudFront URL for the React frontend"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "api_url" {
  description = "Load balancer URL for the FastAPI backend"
  value       = "http://${aws_lb.main.dns_name}"
}

output "ecr_repo_url" {
  description = "ECR repository URL — push Docker image here"
  value       = aws_ecr_repository.backend.repository_url
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_rds_cluster.aurora.endpoint
  sensitive   = true
}

output "sqs_outreach_url" {
  description = "SQS URL for outreach messages"
  value       = aws_sqs_queue.outreach_queue.url
}

output "sns_alerts_arn" {
  description = "SNS topic ARN for blood alerts"
  value       = aws_sns_topic.blood_alerts.arn
}

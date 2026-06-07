variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "db_username" {
  type      = string
  default   = "bloodwarriors"
  sensitive = true
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "email_domain" {
  type    = string
  default = "bloodwarriors.org"
}

variable "github_connection_arn" {
  type        = string
  default     = ""
  description = "CodeStar GitHub connection ARN"
}

variable "github_repo" {
  type        = string
  default     = "your-org/blood-warriors"
  description = "GitHub repo (org/repo)"
}

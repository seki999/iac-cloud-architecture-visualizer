# Dataset 05: Sensitive attributes testing
# Contains test secrets and tokens marked as sensitive or present in configs:
# "TEST_SECRET_DO_NOT_EXPORT_12345"
# Verifies that neither the intermediate InfraGraph attributes, diagram XML,
# inspection summaries, nor logs ever leak this token.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                      = "ap-northeast-1"
  access_key                  = "mock_access_key"
  secret_key                  = "mock_secret_key"
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
}

variable "db_password" {
  type      = string
  sensitive = true
  default   = "TEST_SECRET_DO_NOT_EXPORT_12345"
}

variable "custom_api_token" {
  type      = string
  sensitive = true
  default   = "TOKEN_SECRET_DO_NOT_EXPORT_67890"
}

resource "aws_vpc" "sec" {
  cidr_block = "10.50.0.0/16"
  tags = {
    Name = "sec-vpc"
  }
}

resource "aws_subnet" "db" {
  vpc_id            = aws_vpc.sec.id
  cidr_block        = "10.50.1.0/24"
  availability_zone = "ap-northeast-1a"
  tags = {
    Name = "sec-db-subnet"
  }
}

resource "aws_db_subnet_group" "sec" {
  name       = "sec-db-subnets"
  subnet_ids = [aws_subnet.db.id]
}

# RDS instance configured with sensitive password and custom secret tag
resource "aws_db_instance" "sec_db" {
  identifier           = "sec-db-instance"
  engine               = "postgres"
  instance_class       = "db.t4g.micro"
  allocated_storage    = 20
  username             = "secadmin"
  password             = var.db_password
  db_subnet_group_name = aws_db_subnet_group.sec.name
  skip_final_snapshot  = true

  tags = {
    Name               = "sec-db"
    UnsafeSensitiveTag = "TEST_SECRET_DO_NOT_EXPORT_12345"
  }
}

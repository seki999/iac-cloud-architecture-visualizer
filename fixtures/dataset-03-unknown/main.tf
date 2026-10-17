# Dataset 03: Fresh undeployed environment (all IDs unknown)
# Contains configuration references, computed unknown IDs, and explicit depends_on.
# PLAN-ONLY fixture. Never apply.

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

resource "aws_vpc" "fresh" {
  cidr_block = "10.30.0.0/16"
  tags       = { Name = "fresh-vpc" }
}

resource "aws_subnet" "fresh" {
  vpc_id            = aws_vpc.fresh.id
  cidr_block        = "10.30.1.0/24"
  availability_zone = "ap-northeast-1a"
  tags              = { Name = "fresh-subnet" }
}

resource "aws_security_group" "web" {
  name        = "fresh-web-sg"
  description = "Fresh web security group"
  vpc_id      = aws_vpc.fresh.id
}

resource "aws_s3_bucket" "data" {
  bucket = "fresh-data-bucket-fixture"
}

# The EC2 instance references the unknown subnet ID and unknown SG ID in configuration.
# It also has an explicit `depends_on` pointing to S3 bucket.
# Test expectation:
# 1. EC2 -> Subnet is associated/placed in subnet because configuration.references shows aws_subnet.fresh.id.
# 2. EC2 -> Security Group is associated/attached because vpc_security_group_ids references aws_security_group.web.id.
# 3. EC2 -> S3 has relationship `depends_on`, with evidence `configuration_reference`,
#    and is strictly NOT transformed into network communication or possible_network_access.
resource "aws_instance" "worker" {
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.fresh.id
  vpc_security_group_ids = [aws_security_group.web.id]

  depends_on = [aws_s3_bucket.data]

  tags = { Name = "fresh-worker" }
}

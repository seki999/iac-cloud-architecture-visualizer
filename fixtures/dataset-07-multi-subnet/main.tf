# Dataset 07: Multi-subnet resources
# Tests that resources associated with multiple subnets (ALB, DB subnet group,
# Auto Scaling Group, VPC Endpoint) are NOT incorrectly placed into a single subnet container.
# Instead, their layoutParentId resolves to the containing VPC, while their semanticScope
# records all subnet IDs.

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

resource "aws_vpc" "multi" {
  cidr_block           = "10.70.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = {
    Name = "multi-vpc"
  }
}

resource "aws_subnet" "subnets" {
  count             = 3
  vpc_id            = aws_vpc.multi.id
  cidr_block        = "10.70.${count.index}.0/24"
  availability_zone = "ap-northeast-1${element(["a", "c", "d"], count.index)}"
  tags = {
    Name = "multi-sub-${count.index}"
  }
}

resource "aws_security_group" "lb_sg" {
  name   = "multi-alb-sg"
  vpc_id = aws_vpc.multi.id
}

# 1. Multi-subnet ALB
resource "aws_lb" "cross_subnet_alb" {
  name               = "multi-alb"
  internal           = true
  load_balancer_type = "application"
  subnets            = aws_subnet.subnets[*].id
  security_groups    = [aws_security_group.lb_sg.id]
}

# 2. Multi-subnet DB Subnet Group
resource "aws_db_subnet_group" "cross_subnet_dbsng" {
  name       = "multi-dbsng"
  subnet_ids = aws_subnet.subnets[*].id
}

# 3. Multi-subnet Launch Template & Auto Scaling Group
resource "aws_launch_template" "asg_tpl" {
  name_prefix   = "multi-tpl"
  image_id      = "ami-0123456789abcdef0"
  instance_type = "t3.micro"
}

resource "aws_autoscaling_group" "cross_subnet_asg" {
  name                = "multi-asg"
  vpc_zone_identifier = aws_subnet.subnets[*].id
  min_size            = 1
  max_size            = 4
  desired_capacity    = 2

  launch_template {
    id      = aws_launch_template.asg_tpl.id
    version = "$Latest"
  }
}

# 4. Multi-subnet Interface VPC Endpoint
resource "aws_vpc_endpoint" "s3_interface" {
  vpc_id              = aws_vpc.multi.id
  service_name        = "com.amazonaws.ap-northeast-1.s3"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.subnets[*].id
  security_group_ids  = [aws_security_group.lb_sg.id]
}

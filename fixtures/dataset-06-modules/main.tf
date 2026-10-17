# Dataset 06: Modules, count, and for_each
# Tests module recursion, nested child modules, string for_each keys, numeric count indices,
# and full address parsing (e.g. module.services["api"].module.subservice[0].aws_security_group.sub).

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

resource "aws_vpc" "root_vpc" {
  cidr_block = "10.60.0.0/16"
  tags       = { Name = "mod-vpc" }
}

module "network" {
  source = "./modules/network"
  vpc_id = aws_vpc.root_vpc.id
}

module "services" {
  for_each     = toset(["auth", "api"])
  source       = "./modules/service"
  service_name = each.key
  vpc_id       = aws_vpc.root_vpc.id
  subnet_id    = module.network.subnet_ids[0]
}

# Synthetic 200-resource plan-only architecture. NEVER apply this fixture.
# JSON files remain synthetic: they are not advertised as output of this HCL.
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
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


resource "aws_vpc" "vpc_0" {
  tags                 = { "Name" = "vpc_0" }
  cidr_block           = "10.100.0.0/16"
  enable_dns_hostnames = true
}

resource "aws_vpc" "vpc_1" {
  tags                 = { "Name" = "vpc_1" }
  cidr_block           = "10.101.0.0/16"
  enable_dns_hostnames = true
}

resource "aws_subnet" "subnet_v0_s0" {
  tags              = { "Name" = "subnet_v0_s0" }
  vpc_id            = aws_vpc.vpc_0.id
  cidr_block        = "10.100.0.0/24"
  availability_zone = "ap-northeast-1a"
}

resource "aws_subnet" "subnet_v0_s1" {
  tags              = { "Name" = "subnet_v0_s1" }
  vpc_id            = aws_vpc.vpc_0.id
  cidr_block        = "10.100.1.0/24"
  availability_zone = "ap-northeast-1c"
}

resource "aws_subnet" "subnet_v0_s2" {
  tags              = { "Name" = "subnet_v0_s2" }
  vpc_id            = aws_vpc.vpc_0.id
  cidr_block        = "10.100.2.0/24"
  availability_zone = "ap-northeast-1a"
}

resource "aws_subnet" "subnet_v0_s3" {
  tags              = { "Name" = "subnet_v0_s3" }
  vpc_id            = aws_vpc.vpc_0.id
  cidr_block        = "10.100.3.0/24"
  availability_zone = "ap-northeast-1c"
}

resource "aws_subnet" "subnet_v1_s0" {
  tags              = { "Name" = "subnet_v1_s0" }
  vpc_id            = aws_vpc.vpc_1.id
  cidr_block        = "10.101.0.0/24"
  availability_zone = "ap-northeast-1a"
}

resource "aws_subnet" "subnet_v1_s1" {
  tags              = { "Name" = "subnet_v1_s1" }
  vpc_id            = aws_vpc.vpc_1.id
  cidr_block        = "10.101.1.0/24"
  availability_zone = "ap-northeast-1c"
}

resource "aws_subnet" "subnet_v1_s2" {
  tags              = { "Name" = "subnet_v1_s2" }
  vpc_id            = aws_vpc.vpc_1.id
  cidr_block        = "10.101.2.0/24"
  availability_zone = "ap-northeast-1a"
}

resource "aws_subnet" "subnet_v1_s3" {
  tags              = { "Name" = "subnet_v1_s3" }
  vpc_id            = aws_vpc.vpc_1.id
  cidr_block        = "10.101.3.0/24"
  availability_zone = "ap-northeast-1c"
}

resource "aws_internet_gateway" "igw_v0" {
  tags   = { "Name" = "igw_v0" }
  vpc_id = aws_vpc.vpc_0.id
}

resource "aws_internet_gateway" "igw_v1" {
  tags   = { "Name" = "igw_v1" }
  vpc_id = aws_vpc.vpc_1.id
}

resource "aws_nat_gateway" "nat_v0" {
  tags          = { "Name" = "nat_v0" }
  subnet_id     = aws_subnet.subnet_v0_s0.id
  allocation_id = "eipalloc-0123456789abcdef0"
}

resource "aws_nat_gateway" "nat_v1" {
  tags          = { "Name" = "nat_v1" }
  subnet_id     = aws_subnet.subnet_v1_s0.id
  allocation_id = "eipalloc-0123456789abcdef0"
}

resource "aws_route_table" "rt_pub_v0" {
  tags   = { "Name" = "rt_pub_v0" }
  vpc_id = aws_vpc.vpc_0.id
}

resource "aws_route_table" "rt_priv_v0" {
  tags   = { "Name" = "rt_priv_v0" }
  vpc_id = aws_vpc.vpc_0.id
}

resource "aws_route_table" "rt_pub_v1" {
  tags   = { "Name" = "rt_pub_v1" }
  vpc_id = aws_vpc.vpc_1.id
}

resource "aws_route_table" "rt_priv_v1" {
  tags   = { "Name" = "rt_priv_v1" }
  vpc_id = aws_vpc.vpc_1.id
}

resource "aws_route_table_association" "rta_v0_s0" {
  subnet_id      = aws_subnet.subnet_v0_s0.id
  route_table_id = aws_route_table.rt_pub_v0.id
}

resource "aws_route_table_association" "rta_v0_s1" {
  subnet_id      = aws_subnet.subnet_v0_s1.id
  route_table_id = aws_route_table.rt_pub_v0.id
}

resource "aws_route_table_association" "rta_v0_s2" {
  subnet_id      = aws_subnet.subnet_v0_s2.id
  route_table_id = aws_route_table.rt_priv_v0.id
}

resource "aws_route_table_association" "rta_v0_s3" {
  subnet_id      = aws_subnet.subnet_v0_s3.id
  route_table_id = aws_route_table.rt_priv_v0.id
}

resource "aws_route_table_association" "rta_v1_s0" {
  subnet_id      = aws_subnet.subnet_v1_s0.id
  route_table_id = aws_route_table.rt_pub_v1.id
}

resource "aws_route_table_association" "rta_v1_s1" {
  subnet_id      = aws_subnet.subnet_v1_s1.id
  route_table_id = aws_route_table.rt_pub_v1.id
}

resource "aws_route_table_association" "rta_v1_s2" {
  subnet_id      = aws_subnet.subnet_v1_s2.id
  route_table_id = aws_route_table.rt_priv_v1.id
}

resource "aws_route_table_association" "rta_v1_s3" {
  subnet_id      = aws_subnet.subnet_v1_s3.id
  route_table_id = aws_route_table.rt_priv_v1.id
}

resource "aws_security_group" "sg_0" {
  tags        = { "Name" = "sg_0" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 0"
}

resource "aws_security_group" "sg_1" {
  tags        = { "Name" = "sg_1" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 1"
}

resource "aws_security_group" "sg_2" {
  tags        = { "Name" = "sg_2" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 2"
}

resource "aws_security_group" "sg_3" {
  tags        = { "Name" = "sg_3" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 3"
}

resource "aws_security_group" "sg_4" {
  tags        = { "Name" = "sg_4" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 4"
}

resource "aws_security_group" "sg_5" {
  tags        = { "Name" = "sg_5" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 5"
}

resource "aws_security_group" "sg_6" {
  tags        = { "Name" = "sg_6" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 6"
}

resource "aws_security_group" "sg_7" {
  tags        = { "Name" = "sg_7" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 7"
}

resource "aws_security_group" "sg_8" {
  tags        = { "Name" = "sg_8" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 8"
}

resource "aws_security_group" "sg_9" {
  tags        = { "Name" = "sg_9" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 9"
}

resource "aws_security_group" "sg_10" {
  tags        = { "Name" = "sg_10" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 10"
}

resource "aws_security_group" "sg_11" {
  tags        = { "Name" = "sg_11" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 11"
}

resource "aws_security_group" "sg_12" {
  tags        = { "Name" = "sg_12" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 12"
}

resource "aws_security_group" "sg_13" {
  tags        = { "Name" = "sg_13" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 13"
}

resource "aws_security_group" "sg_14" {
  tags        = { "Name" = "sg_14" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 14"
}

resource "aws_security_group" "sg_15" {
  tags        = { "Name" = "sg_15" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 15"
}

resource "aws_security_group" "sg_16" {
  tags        = { "Name" = "sg_16" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 16"
}

resource "aws_security_group" "sg_17" {
  tags        = { "Name" = "sg_17" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 17"
}

resource "aws_security_group" "sg_18" {
  tags        = { "Name" = "sg_18" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 18"
}

resource "aws_security_group" "sg_19" {
  tags        = { "Name" = "sg_19" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 19"
}

resource "aws_security_group" "sg_20" {
  tags        = { "Name" = "sg_20" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 20"
}

resource "aws_security_group" "sg_21" {
  tags        = { "Name" = "sg_21" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 21"
}

resource "aws_security_group" "sg_22" {
  tags        = { "Name" = "sg_22" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 22"
}

resource "aws_security_group" "sg_23" {
  tags        = { "Name" = "sg_23" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 23"
}

resource "aws_security_group" "sg_24" {
  tags        = { "Name" = "sg_24" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 24"
}

resource "aws_security_group" "sg_25" {
  tags        = { "Name" = "sg_25" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 25"
}

resource "aws_security_group" "sg_26" {
  tags        = { "Name" = "sg_26" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 26"
}

resource "aws_security_group" "sg_27" {
  tags        = { "Name" = "sg_27" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 27"
}

resource "aws_security_group" "sg_28" {
  tags        = { "Name" = "sg_28" }
  vpc_id      = aws_vpc.vpc_0.id
  description = "Security group 28"
}

resource "aws_security_group" "sg_29" {
  tags        = { "Name" = "sg_29" }
  vpc_id      = aws_vpc.vpc_1.id
  description = "Security group 29"
}

resource "aws_instance" "app_vm_0" {
  tags                   = { "Name" = "app_vm_0" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s0.id
  vpc_security_group_ids = [aws_security_group.sg_0.id]
}

resource "aws_instance" "app_vm_1" {
  tags                   = { "Name" = "app_vm_1" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s1.id
  vpc_security_group_ids = [aws_security_group.sg_1.id]
}

resource "aws_instance" "app_vm_2" {
  tags                   = { "Name" = "app_vm_2" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s2.id
  vpc_security_group_ids = [aws_security_group.sg_2.id]
}

resource "aws_instance" "app_vm_3" {
  tags                   = { "Name" = "app_vm_3" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s3.id
  vpc_security_group_ids = [aws_security_group.sg_3.id]
}

resource "aws_instance" "app_vm_4" {
  tags                   = { "Name" = "app_vm_4" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s0.id
  vpc_security_group_ids = [aws_security_group.sg_4.id]
}

resource "aws_instance" "app_vm_5" {
  tags                   = { "Name" = "app_vm_5" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s1.id
  vpc_security_group_ids = [aws_security_group.sg_5.id]
}

resource "aws_instance" "app_vm_6" {
  tags                   = { "Name" = "app_vm_6" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s2.id
  vpc_security_group_ids = [aws_security_group.sg_6.id]
}

resource "aws_instance" "app_vm_7" {
  tags                   = { "Name" = "app_vm_7" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s3.id
  vpc_security_group_ids = [aws_security_group.sg_7.id]
}

resource "aws_instance" "app_vm_8" {
  tags                   = { "Name" = "app_vm_8" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s0.id
  vpc_security_group_ids = [aws_security_group.sg_8.id]
}

resource "aws_instance" "app_vm_9" {
  tags                   = { "Name" = "app_vm_9" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s1.id
  vpc_security_group_ids = [aws_security_group.sg_9.id]
}

resource "aws_instance" "app_vm_10" {
  tags                   = { "Name" = "app_vm_10" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s2.id
  vpc_security_group_ids = [aws_security_group.sg_10.id]
}

resource "aws_instance" "app_vm_11" {
  tags                   = { "Name" = "app_vm_11" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s3.id
  vpc_security_group_ids = [aws_security_group.sg_11.id]
}

resource "aws_instance" "app_vm_12" {
  tags                   = { "Name" = "app_vm_12" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s0.id
  vpc_security_group_ids = [aws_security_group.sg_12.id]
}

resource "aws_instance" "app_vm_13" {
  tags                   = { "Name" = "app_vm_13" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s1.id
  vpc_security_group_ids = [aws_security_group.sg_13.id]
}

resource "aws_instance" "app_vm_14" {
  tags                   = { "Name" = "app_vm_14" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s2.id
  vpc_security_group_ids = [aws_security_group.sg_14.id]
}

resource "aws_instance" "app_vm_15" {
  tags                   = { "Name" = "app_vm_15" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s3.id
  vpc_security_group_ids = [aws_security_group.sg_15.id]
}

resource "aws_instance" "app_vm_16" {
  tags                   = { "Name" = "app_vm_16" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s0.id
  vpc_security_group_ids = [aws_security_group.sg_16.id]
}

resource "aws_instance" "app_vm_17" {
  tags                   = { "Name" = "app_vm_17" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s1.id
  vpc_security_group_ids = [aws_security_group.sg_17.id]
}

resource "aws_instance" "app_vm_18" {
  tags                   = { "Name" = "app_vm_18" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s2.id
  vpc_security_group_ids = [aws_security_group.sg_18.id]
}

resource "aws_instance" "app_vm_19" {
  tags                   = { "Name" = "app_vm_19" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s3.id
  vpc_security_group_ids = [aws_security_group.sg_19.id]
}

resource "aws_instance" "app_vm_20" {
  tags                   = { "Name" = "app_vm_20" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s0.id
  vpc_security_group_ids = [aws_security_group.sg_20.id]
}

resource "aws_instance" "app_vm_21" {
  tags                   = { "Name" = "app_vm_21" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s1.id
  vpc_security_group_ids = [aws_security_group.sg_21.id]
}

resource "aws_instance" "app_vm_22" {
  tags                   = { "Name" = "app_vm_22" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s2.id
  vpc_security_group_ids = [aws_security_group.sg_22.id]
}

resource "aws_instance" "app_vm_23" {
  tags                   = { "Name" = "app_vm_23" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s3.id
  vpc_security_group_ids = [aws_security_group.sg_23.id]
}

resource "aws_instance" "app_vm_24" {
  tags                   = { "Name" = "app_vm_24" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s0.id
  vpc_security_group_ids = [aws_security_group.sg_24.id]
}

resource "aws_instance" "app_vm_25" {
  tags                   = { "Name" = "app_vm_25" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s1.id
  vpc_security_group_ids = [aws_security_group.sg_25.id]
}

resource "aws_instance" "app_vm_26" {
  tags                   = { "Name" = "app_vm_26" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s2.id
  vpc_security_group_ids = [aws_security_group.sg_26.id]
}

resource "aws_instance" "app_vm_27" {
  tags                   = { "Name" = "app_vm_27" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s3.id
  vpc_security_group_ids = [aws_security_group.sg_27.id]
}

resource "aws_instance" "app_vm_28" {
  tags                   = { "Name" = "app_vm_28" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s0.id
  vpc_security_group_ids = [aws_security_group.sg_28.id]
}

resource "aws_instance" "app_vm_29" {
  tags                   = { "Name" = "app_vm_29" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s1.id
  vpc_security_group_ids = [aws_security_group.sg_29.id]
}

resource "aws_instance" "app_vm_30" {
  tags                   = { "Name" = "app_vm_30" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s2.id
  vpc_security_group_ids = [aws_security_group.sg_0.id]
}

resource "aws_instance" "app_vm_31" {
  tags                   = { "Name" = "app_vm_31" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s3.id
  vpc_security_group_ids = [aws_security_group.sg_1.id]
}

resource "aws_instance" "app_vm_32" {
  tags                   = { "Name" = "app_vm_32" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s0.id
  vpc_security_group_ids = [aws_security_group.sg_2.id]
}

resource "aws_instance" "app_vm_33" {
  tags                   = { "Name" = "app_vm_33" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s1.id
  vpc_security_group_ids = [aws_security_group.sg_3.id]
}

resource "aws_instance" "app_vm_34" {
  tags                   = { "Name" = "app_vm_34" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v0_s2.id
  vpc_security_group_ids = [aws_security_group.sg_4.id]
}

resource "aws_instance" "app_vm_35" {
  tags                   = { "Name" = "app_vm_35" }
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.subnet_v1_s3.id
  vpc_security_group_ids = [aws_security_group.sg_5.id]
}

resource "aws_s3_bucket" "data_bucket_0" {
  tags   = { "Name" = "data_bucket_0" }
  bucket = "benchmark-bucket-0"
}

resource "aws_s3_bucket" "data_bucket_1" {
  tags   = { "Name" = "data_bucket_1" }
  bucket = "benchmark-bucket-1"
}

resource "aws_s3_bucket" "data_bucket_2" {
  tags   = { "Name" = "data_bucket_2" }
  bucket = "benchmark-bucket-2"
}

resource "aws_s3_bucket" "data_bucket_3" {
  tags   = { "Name" = "data_bucket_3" }
  bucket = "benchmark-bucket-3"
}

resource "aws_s3_bucket" "data_bucket_4" {
  tags   = { "Name" = "data_bucket_4" }
  bucket = "benchmark-bucket-4"
}

resource "aws_s3_bucket" "data_bucket_5" {
  tags   = { "Name" = "data_bucket_5" }
  bucket = "benchmark-bucket-5"
}

resource "aws_s3_bucket" "data_bucket_6" {
  tags   = { "Name" = "data_bucket_6" }
  bucket = "benchmark-bucket-6"
}

resource "aws_s3_bucket" "data_bucket_7" {
  tags   = { "Name" = "data_bucket_7" }
  bucket = "benchmark-bucket-7"
}

resource "aws_s3_bucket" "data_bucket_8" {
  tags   = { "Name" = "data_bucket_8" }
  bucket = "benchmark-bucket-8"
}

resource "aws_s3_bucket" "data_bucket_9" {
  tags   = { "Name" = "data_bucket_9" }
  bucket = "benchmark-bucket-9"
}

resource "aws_s3_bucket" "data_bucket_10" {
  tags   = { "Name" = "data_bucket_10" }
  bucket = "benchmark-bucket-10"
}

resource "aws_s3_bucket" "data_bucket_11" {
  tags   = { "Name" = "data_bucket_11" }
  bucket = "benchmark-bucket-11"
}

resource "aws_s3_bucket" "data_bucket_12" {
  tags   = { "Name" = "data_bucket_12" }
  bucket = "benchmark-bucket-12"
}

resource "aws_s3_bucket" "data_bucket_13" {
  tags   = { "Name" = "data_bucket_13" }
  bucket = "benchmark-bucket-13"
}

resource "aws_s3_bucket" "data_bucket_14" {
  tags   = { "Name" = "data_bucket_14" }
  bucket = "benchmark-bucket-14"
}

resource "aws_s3_bucket" "data_bucket_15" {
  tags   = { "Name" = "data_bucket_15" }
  bucket = "benchmark-bucket-15"
}

resource "aws_s3_bucket" "data_bucket_16" {
  tags   = { "Name" = "data_bucket_16" }
  bucket = "benchmark-bucket-16"
}

resource "aws_s3_bucket" "data_bucket_17" {
  tags   = { "Name" = "data_bucket_17" }
  bucket = "benchmark-bucket-17"
}

resource "aws_s3_bucket" "data_bucket_18" {
  tags   = { "Name" = "data_bucket_18" }
  bucket = "benchmark-bucket-18"
}

resource "aws_s3_bucket" "data_bucket_19" {
  tags   = { "Name" = "data_bucket_19" }
  bucket = "benchmark-bucket-19"
}

resource "aws_db_subnet_group" "dbsng_0" {
  tags       = { "Name" = "dbsng_0" }
  subnet_ids = [aws_subnet.subnet_v0_s0.id, aws_subnet.subnet_v0_s1.id]
  name       = "dbsng_0"
}

resource "aws_db_subnet_group" "dbsng_1" {
  tags       = { "Name" = "dbsng_1" }
  subnet_ids = [aws_subnet.subnet_v1_s0.id, aws_subnet.subnet_v1_s1.id]
  name       = "dbsng_1"
}

resource "aws_db_subnet_group" "dbsng_2" {
  tags       = { "Name" = "dbsng_2" }
  subnet_ids = [aws_subnet.subnet_v0_s0.id, aws_subnet.subnet_v0_s1.id]
  name       = "dbsng_2"
}

resource "aws_db_subnet_group" "dbsng_3" {
  tags       = { "Name" = "dbsng_3" }
  subnet_ids = [aws_subnet.subnet_v1_s0.id, aws_subnet.subnet_v1_s1.id]
  name       = "dbsng_3"
}

resource "aws_db_subnet_group" "dbsng_4" {
  tags       = { "Name" = "dbsng_4" }
  subnet_ids = [aws_subnet.subnet_v0_s0.id, aws_subnet.subnet_v0_s1.id]
  name       = "dbsng_4"
}

resource "aws_db_subnet_group" "dbsng_5" {
  tags       = { "Name" = "dbsng_5" }
  subnet_ids = [aws_subnet.subnet_v1_s0.id, aws_subnet.subnet_v1_s1.id]
  name       = "dbsng_5"
}

resource "aws_db_subnet_group" "dbsng_6" {
  tags       = { "Name" = "dbsng_6" }
  subnet_ids = [aws_subnet.subnet_v0_s0.id, aws_subnet.subnet_v0_s1.id]
  name       = "dbsng_6"
}

resource "aws_db_subnet_group" "dbsng_7" {
  tags       = { "Name" = "dbsng_7" }
  subnet_ids = [aws_subnet.subnet_v1_s0.id, aws_subnet.subnet_v1_s1.id]
  name       = "dbsng_7"
}

resource "aws_db_subnet_group" "dbsng_8" {
  tags       = { "Name" = "dbsng_8" }
  subnet_ids = [aws_subnet.subnet_v0_s0.id, aws_subnet.subnet_v0_s1.id]
  name       = "dbsng_8"
}

resource "aws_db_subnet_group" "dbsng_9" {
  tags       = { "Name" = "dbsng_9" }
  subnet_ids = [aws_subnet.subnet_v1_s0.id, aws_subnet.subnet_v1_s1.id]
  name       = "dbsng_9"
}

resource "aws_db_instance" "rds_0" {
  tags                   = { "Name" = "rds_0" }
  engine                 = "postgres"
  instance_class         = "db.t4g.micro"
  db_subnet_group_name   = aws_db_subnet_group.dbsng_0.name
  vpc_security_group_ids = [aws_security_group.sg_0.id]
  allocated_storage      = 20
  username               = "fixture_admin"
  password               = "TEST_PASSWORD_NOT_REAL_12345"
  skip_final_snapshot    = true
}

resource "aws_db_instance" "rds_1" {
  tags                   = { "Name" = "rds_1" }
  engine                 = "postgres"
  instance_class         = "db.t4g.micro"
  db_subnet_group_name   = aws_db_subnet_group.dbsng_1.name
  vpc_security_group_ids = [aws_security_group.sg_1.id]
  allocated_storage      = 20
  username               = "fixture_admin"
  password               = "TEST_PASSWORD_NOT_REAL_12345"
  skip_final_snapshot    = true
}

resource "aws_db_instance" "rds_2" {
  tags                   = { "Name" = "rds_2" }
  engine                 = "postgres"
  instance_class         = "db.t4g.micro"
  db_subnet_group_name   = aws_db_subnet_group.dbsng_2.name
  vpc_security_group_ids = [aws_security_group.sg_2.id]
  allocated_storage      = 20
  username               = "fixture_admin"
  password               = "TEST_PASSWORD_NOT_REAL_12345"
  skip_final_snapshot    = true
}

resource "aws_db_instance" "rds_3" {
  tags                   = { "Name" = "rds_3" }
  engine                 = "postgres"
  instance_class         = "db.t4g.micro"
  db_subnet_group_name   = aws_db_subnet_group.dbsng_3.name
  vpc_security_group_ids = [aws_security_group.sg_3.id]
  allocated_storage      = 20
  username               = "fixture_admin"
  password               = "TEST_PASSWORD_NOT_REAL_12345"
  skip_final_snapshot    = true
}

resource "aws_db_instance" "rds_4" {
  tags                   = { "Name" = "rds_4" }
  engine                 = "postgres"
  instance_class         = "db.t4g.micro"
  db_subnet_group_name   = aws_db_subnet_group.dbsng_4.name
  vpc_security_group_ids = [aws_security_group.sg_4.id]
  allocated_storage      = 20
  username               = "fixture_admin"
  password               = "TEST_PASSWORD_NOT_REAL_12345"
  skip_final_snapshot    = true
}

resource "aws_db_instance" "rds_5" {
  tags                   = { "Name" = "rds_5" }
  engine                 = "postgres"
  instance_class         = "db.t4g.micro"
  db_subnet_group_name   = aws_db_subnet_group.dbsng_5.name
  vpc_security_group_ids = [aws_security_group.sg_5.id]
  allocated_storage      = 20
  username               = "fixture_admin"
  password               = "TEST_PASSWORD_NOT_REAL_12345"
  skip_final_snapshot    = true
}

resource "aws_db_instance" "rds_6" {
  tags                   = { "Name" = "rds_6" }
  engine                 = "postgres"
  instance_class         = "db.t4g.micro"
  db_subnet_group_name   = aws_db_subnet_group.dbsng_6.name
  vpc_security_group_ids = [aws_security_group.sg_6.id]
  allocated_storage      = 20
  username               = "fixture_admin"
  password               = "TEST_PASSWORD_NOT_REAL_12345"
  skip_final_snapshot    = true
}

resource "aws_db_instance" "rds_7" {
  tags                   = { "Name" = "rds_7" }
  engine                 = "postgres"
  instance_class         = "db.t4g.micro"
  db_subnet_group_name   = aws_db_subnet_group.dbsng_7.name
  vpc_security_group_ids = [aws_security_group.sg_7.id]
  allocated_storage      = 20
  username               = "fixture_admin"
  password               = "TEST_PASSWORD_NOT_REAL_12345"
  skip_final_snapshot    = true
}

resource "aws_db_instance" "rds_8" {
  tags                   = { "Name" = "rds_8" }
  engine                 = "postgres"
  instance_class         = "db.t4g.micro"
  db_subnet_group_name   = aws_db_subnet_group.dbsng_8.name
  vpc_security_group_ids = [aws_security_group.sg_8.id]
  allocated_storage      = 20
  username               = "fixture_admin"
  password               = "TEST_PASSWORD_NOT_REAL_12345"
  skip_final_snapshot    = true
}

resource "aws_db_instance" "rds_9" {
  tags                   = { "Name" = "rds_9" }
  engine                 = "postgres"
  instance_class         = "db.t4g.micro"
  db_subnet_group_name   = aws_db_subnet_group.dbsng_9.name
  vpc_security_group_ids = [aws_security_group.sg_9.id]
  allocated_storage      = 20
  username               = "fixture_admin"
  password               = "TEST_PASSWORD_NOT_REAL_12345"
  skip_final_snapshot    = true
}

resource "aws_lb" "alb_0" {
  tags               = { "Name" = "alb_0" }
  load_balancer_type = "application"
  subnets            = [aws_subnet.subnet_v0_s0.id, aws_subnet.subnet_v0_s1.id]
  security_groups    = [aws_security_group.sg_0.id]
}

resource "aws_lb" "alb_1" {
  tags               = { "Name" = "alb_1" }
  load_balancer_type = "application"
  subnets            = [aws_subnet.subnet_v1_s0.id, aws_subnet.subnet_v1_s1.id]
  security_groups    = [aws_security_group.sg_1.id]
}

resource "aws_lb" "alb_2" {
  tags               = { "Name" = "alb_2" }
  load_balancer_type = "application"
  subnets            = [aws_subnet.subnet_v0_s0.id, aws_subnet.subnet_v0_s1.id]
  security_groups    = [aws_security_group.sg_2.id]
}

resource "aws_lb" "alb_3" {
  tags               = { "Name" = "alb_3" }
  load_balancer_type = "application"
  subnets            = [aws_subnet.subnet_v1_s0.id, aws_subnet.subnet_v1_s1.id]
  security_groups    = [aws_security_group.sg_3.id]
}

resource "aws_lb" "alb_4" {
  tags               = { "Name" = "alb_4" }
  load_balancer_type = "application"
  subnets            = [aws_subnet.subnet_v0_s0.id, aws_subnet.subnet_v0_s1.id]
  security_groups    = [aws_security_group.sg_4.id]
}

resource "aws_lb" "alb_5" {
  tags               = { "Name" = "alb_5" }
  load_balancer_type = "application"
  subnets            = [aws_subnet.subnet_v1_s0.id, aws_subnet.subnet_v1_s1.id]
  security_groups    = [aws_security_group.sg_5.id]
}

resource "aws_lb" "alb_6" {
  tags               = { "Name" = "alb_6" }
  load_balancer_type = "application"
  subnets            = [aws_subnet.subnet_v0_s0.id, aws_subnet.subnet_v0_s1.id]
  security_groups    = [aws_security_group.sg_6.id]
}

resource "aws_lb" "alb_7" {
  tags               = { "Name" = "alb_7" }
  load_balancer_type = "application"
  subnets            = [aws_subnet.subnet_v1_s0.id, aws_subnet.subnet_v1_s1.id]
  security_groups    = [aws_security_group.sg_7.id]
}

resource "aws_lb" "alb_8" {
  tags               = { "Name" = "alb_8" }
  load_balancer_type = "application"
  subnets            = [aws_subnet.subnet_v0_s0.id, aws_subnet.subnet_v0_s1.id]
  security_groups    = [aws_security_group.sg_8.id]
}

resource "aws_lb" "alb_9" {
  tags               = { "Name" = "alb_9" }
  load_balancer_type = "application"
  subnets            = [aws_subnet.subnet_v1_s0.id, aws_subnet.subnet_v1_s1.id]
  security_groups    = [aws_security_group.sg_9.id]
}

resource "aws_lb_target_group" "tg_0" {
  tags        = { "Name" = "tg_0" }
  vpc_id      = aws_vpc.vpc_0.id
  port        = 8080
  protocol    = "HTTP"
  target_type = "instance"
  name        = "fixture-tg-0"
}

resource "aws_lb_target_group" "tg_1" {
  tags        = { "Name" = "tg_1" }
  vpc_id      = aws_vpc.vpc_1.id
  port        = 8080
  protocol    = "HTTP"
  target_type = "instance"
  name        = "fixture-tg-1"
}

resource "aws_lb_target_group" "tg_2" {
  tags        = { "Name" = "tg_2" }
  vpc_id      = aws_vpc.vpc_0.id
  port        = 8080
  protocol    = "HTTP"
  target_type = "instance"
  name        = "fixture-tg-2"
}

resource "aws_lb_target_group" "tg_3" {
  tags        = { "Name" = "tg_3" }
  vpc_id      = aws_vpc.vpc_1.id
  port        = 8080
  protocol    = "HTTP"
  target_type = "instance"
  name        = "fixture-tg-3"
}

resource "aws_lb_target_group" "tg_4" {
  tags        = { "Name" = "tg_4" }
  vpc_id      = aws_vpc.vpc_0.id
  port        = 8080
  protocol    = "HTTP"
  target_type = "instance"
  name        = "fixture-tg-4"
}

resource "aws_lb_target_group" "tg_5" {
  tags        = { "Name" = "tg_5" }
  vpc_id      = aws_vpc.vpc_1.id
  port        = 8080
  protocol    = "HTTP"
  target_type = "instance"
  name        = "fixture-tg-5"
}

resource "aws_lb_target_group" "tg_6" {
  tags        = { "Name" = "tg_6" }
  vpc_id      = aws_vpc.vpc_0.id
  port        = 8080
  protocol    = "HTTP"
  target_type = "instance"
  name        = "fixture-tg-6"
}

resource "aws_lb_target_group" "tg_7" {
  tags        = { "Name" = "tg_7" }
  vpc_id      = aws_vpc.vpc_1.id
  port        = 8080
  protocol    = "HTTP"
  target_type = "instance"
  name        = "fixture-tg-7"
}

resource "aws_lb_target_group" "tg_8" {
  tags        = { "Name" = "tg_8" }
  vpc_id      = aws_vpc.vpc_0.id
  port        = 8080
  protocol    = "HTTP"
  target_type = "instance"
  name        = "fixture-tg-8"
}

resource "aws_lb_target_group" "tg_9" {
  tags        = { "Name" = "tg_9" }
  vpc_id      = aws_vpc.vpc_1.id
  port        = 8080
  protocol    = "HTTP"
  target_type = "instance"
  name        = "fixture-tg-9"
}

resource "aws_lb_listener" "listener_0" {
  tags              = { "Name" = "listener_0" }
  load_balancer_arn = aws_lb.alb_0.arn
  port              = 80
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_0.arn
  }
}

resource "aws_lb_listener" "listener_1" {
  tags              = { "Name" = "listener_1" }
  load_balancer_arn = aws_lb.alb_1.arn
  port              = 80
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_1.arn
  }
}

resource "aws_lb_listener" "listener_2" {
  tags              = { "Name" = "listener_2" }
  load_balancer_arn = aws_lb.alb_2.arn
  port              = 80
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_2.arn
  }
}

resource "aws_lb_listener" "listener_3" {
  tags              = { "Name" = "listener_3" }
  load_balancer_arn = aws_lb.alb_3.arn
  port              = 80
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_3.arn
  }
}

resource "aws_lb_listener" "listener_4" {
  tags              = { "Name" = "listener_4" }
  load_balancer_arn = aws_lb.alb_4.arn
  port              = 80
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_4.arn
  }
}

resource "aws_lb_listener" "listener_5" {
  tags              = { "Name" = "listener_5" }
  load_balancer_arn = aws_lb.alb_5.arn
  port              = 80
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_5.arn
  }
}

resource "aws_lb_listener" "listener_6" {
  tags              = { "Name" = "listener_6" }
  load_balancer_arn = aws_lb.alb_6.arn
  port              = 80
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_6.arn
  }
}

resource "aws_lb_listener" "listener_7" {
  tags              = { "Name" = "listener_7" }
  load_balancer_arn = aws_lb.alb_7.arn
  port              = 80
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_7.arn
  }
}

resource "aws_lb_listener" "listener_8" {
  tags              = { "Name" = "listener_8" }
  load_balancer_arn = aws_lb.alb_8.arn
  port              = 80
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_8.arn
  }
}

resource "aws_lb_listener" "listener_9" {
  tags              = { "Name" = "listener_9" }
  load_balancer_arn = aws_lb.alb_9.arn
  port              = 80
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_9.arn
  }
}

resource "aws_ecs_cluster" "ecs_cluster_0" {
  tags = { "Name" = "ecs_cluster_0" }
  name = "cluster-0"
}

resource "aws_ecs_cluster" "ecs_cluster_1" {
  tags = { "Name" = "ecs_cluster_1" }
  name = "cluster-1"
}

resource "aws_ecs_cluster" "ecs_cluster_2" {
  tags = { "Name" = "ecs_cluster_2" }
  name = "cluster-2"
}

resource "aws_ecs_cluster" "ecs_cluster_3" {
  tags = { "Name" = "ecs_cluster_3" }
  name = "cluster-3"
}

resource "aws_ecs_cluster" "ecs_cluster_4" {
  tags = { "Name" = "ecs_cluster_4" }
  name = "cluster-4"
}

resource "aws_ecs_cluster" "ecs_cluster_5" {
  tags = { "Name" = "ecs_cluster_5" }
  name = "cluster-5"
}

resource "aws_ecs_cluster" "ecs_cluster_6" {
  tags = { "Name" = "ecs_cluster_6" }
  name = "cluster-6"
}

resource "aws_ecs_cluster" "ecs_cluster_7" {
  tags = { "Name" = "ecs_cluster_7" }
  name = "cluster-7"
}

resource "aws_ecs_cluster" "ecs_cluster_8" {
  tags = { "Name" = "ecs_cluster_8" }
  name = "cluster-8"
}

resource "aws_ecs_cluster" "ecs_cluster_9" {
  tags = { "Name" = "ecs_cluster_9" }
  name = "cluster-9"
}

resource "aws_ecs_service" "ecs_service_0" {
  tags          = { "Name" = "ecs_service_0" }
  cluster       = aws_ecs_cluster.ecs_cluster_0.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_0.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s0.id]
  }
  name            = "ecs_service_0"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_1" {
  tags          = { "Name" = "ecs_service_1" }
  cluster       = aws_ecs_cluster.ecs_cluster_1.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_1.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s1.id]
  }
  name            = "ecs_service_1"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_2" {
  tags          = { "Name" = "ecs_service_2" }
  cluster       = aws_ecs_cluster.ecs_cluster_2.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_2.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s2.id]
  }
  name            = "ecs_service_2"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_3" {
  tags          = { "Name" = "ecs_service_3" }
  cluster       = aws_ecs_cluster.ecs_cluster_3.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_3.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s3.id]
  }
  name            = "ecs_service_3"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_4" {
  tags          = { "Name" = "ecs_service_4" }
  cluster       = aws_ecs_cluster.ecs_cluster_4.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_4.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s0.id]
  }
  name            = "ecs_service_4"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_5" {
  tags          = { "Name" = "ecs_service_5" }
  cluster       = aws_ecs_cluster.ecs_cluster_5.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_5.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s1.id]
  }
  name            = "ecs_service_5"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_6" {
  tags          = { "Name" = "ecs_service_6" }
  cluster       = aws_ecs_cluster.ecs_cluster_6.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_6.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s2.id]
  }
  name            = "ecs_service_6"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_7" {
  tags          = { "Name" = "ecs_service_7" }
  cluster       = aws_ecs_cluster.ecs_cluster_7.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_7.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s3.id]
  }
  name            = "ecs_service_7"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_8" {
  tags          = { "Name" = "ecs_service_8" }
  cluster       = aws_ecs_cluster.ecs_cluster_8.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_8.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s0.id]
  }
  name            = "ecs_service_8"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_9" {
  tags          = { "Name" = "ecs_service_9" }
  cluster       = aws_ecs_cluster.ecs_cluster_9.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_9.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s1.id]
  }
  name            = "ecs_service_9"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_10" {
  tags          = { "Name" = "ecs_service_10" }
  cluster       = aws_ecs_cluster.ecs_cluster_0.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_0.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s2.id]
  }
  name            = "ecs_service_10"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_11" {
  tags          = { "Name" = "ecs_service_11" }
  cluster       = aws_ecs_cluster.ecs_cluster_1.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_1.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s3.id]
  }
  name            = "ecs_service_11"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_12" {
  tags          = { "Name" = "ecs_service_12" }
  cluster       = aws_ecs_cluster.ecs_cluster_2.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_2.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s0.id]
  }
  name            = "ecs_service_12"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_13" {
  tags          = { "Name" = "ecs_service_13" }
  cluster       = aws_ecs_cluster.ecs_cluster_3.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_3.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s1.id]
  }
  name            = "ecs_service_13"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_14" {
  tags          = { "Name" = "ecs_service_14" }
  cluster       = aws_ecs_cluster.ecs_cluster_4.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_4.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s2.id]
  }
  name            = "ecs_service_14"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_15" {
  tags          = { "Name" = "ecs_service_15" }
  cluster       = aws_ecs_cluster.ecs_cluster_5.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_5.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s3.id]
  }
  name            = "ecs_service_15"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_16" {
  tags          = { "Name" = "ecs_service_16" }
  cluster       = aws_ecs_cluster.ecs_cluster_6.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_6.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s0.id]
  }
  name            = "ecs_service_16"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_17" {
  tags          = { "Name" = "ecs_service_17" }
  cluster       = aws_ecs_cluster.ecs_cluster_7.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_7.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s1.id]
  }
  name            = "ecs_service_17"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_18" {
  tags          = { "Name" = "ecs_service_18" }
  cluster       = aws_ecs_cluster.ecs_cluster_8.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_8.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s2.id]
  }
  name            = "ecs_service_18"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_19" {
  tags          = { "Name" = "ecs_service_19" }
  cluster       = aws_ecs_cluster.ecs_cluster_9.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_9.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s3.id]
  }
  name            = "ecs_service_19"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_20" {
  tags          = { "Name" = "ecs_service_20" }
  cluster       = aws_ecs_cluster.ecs_cluster_0.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_0.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s0.id]
  }
  name            = "ecs_service_20"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_21" {
  tags          = { "Name" = "ecs_service_21" }
  cluster       = aws_ecs_cluster.ecs_cluster_1.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_1.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s1.id]
  }
  name            = "ecs_service_21"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_22" {
  tags          = { "Name" = "ecs_service_22" }
  cluster       = aws_ecs_cluster.ecs_cluster_2.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_2.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s2.id]
  }
  name            = "ecs_service_22"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_23" {
  tags          = { "Name" = "ecs_service_23" }
  cluster       = aws_ecs_cluster.ecs_cluster_3.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_3.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s3.id]
  }
  name            = "ecs_service_23"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_24" {
  tags          = { "Name" = "ecs_service_24" }
  cluster       = aws_ecs_cluster.ecs_cluster_4.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_4.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s0.id]
  }
  name            = "ecs_service_24"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_25" {
  tags          = { "Name" = "ecs_service_25" }
  cluster       = aws_ecs_cluster.ecs_cluster_5.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_5.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s1.id]
  }
  name            = "ecs_service_25"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_26" {
  tags          = { "Name" = "ecs_service_26" }
  cluster       = aws_ecs_cluster.ecs_cluster_6.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_6.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v0_s2.id]
  }
  name            = "ecs_service_26"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

resource "aws_ecs_service" "ecs_service_27" {
  tags          = { "Name" = "ecs_service_27" }
  cluster       = aws_ecs_cluster.ecs_cluster_7.id
  desired_count = 2
  load_balancer {
    target_group_arn = aws_lb_target_group.tg_7.arn
    container_name   = "app"
    container_port   = 8080
  }
  network_configuration {
    subnets = [aws_subnet.subnet_v1_s3.id]
  }
  name            = "ecs_service_27"
  task_definition = "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1"
  launch_type     = "FARGATE"
}

variable "vpc_id" {
  type = string
}

resource "aws_subnet" "mod_subnets" {
  count             = 2
  vpc_id            = var.vpc_id
  cidr_block        = "10.60.${count.index}.0/24"
  availability_zone = "ap-northeast-1a"
  tags = {
    Name = "mod-sub-${count.index}"
  }
}

output "subnet_ids" {
  value = aws_subnet.mod_subnets[*].id
}

variable "service_name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

resource "aws_security_group" "svc" {
  name        = "mod-sg-${var.service_name}"
  description = "Security group for service ${var.service_name}"
  vpc_id      = var.vpc_id
}

module "subservice" {
  count          = 2
  source         = "./nested"
  component_id   = "${var.service_name}-${count.index}"
  parent_sg_id   = aws_security_group.svc.id
  vpc_id         = var.vpc_id
}

variable "component_id" {
  type = string
}

variable "parent_sg_id" {
  type = string
}

variable "vpc_id" {
  type = string
}

resource "aws_security_group" "sub" {
  name        = "nested-sg-${var.component_id}"
  description = "Nested SG ${var.component_id}"
  vpc_id      = var.vpc_id
}

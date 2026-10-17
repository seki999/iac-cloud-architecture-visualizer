variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "azs" {
  type    = list(string)
  default = ["ap-northeast-1a", "ap-northeast-1c"]
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "ami_id" {
  description = "Placeholder AMI ID (fixture only, never applied)."
  type        = string
  default     = "ami-0123456789abcdef0"
}

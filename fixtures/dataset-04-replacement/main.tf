# Dataset 04: Resource replacement actions
# Demonstrates both ["delete", "create"] and ["create", "delete"] actions.
# Uses built-in `terraform_data` so it can be applied locally without any provider.

terraform {
  required_version = ">= 1.5.0"
}

variable "revision" {
  type    = number
  default = 1
}

# Standard replacement: destroy then create => ["delete", "create"]
resource "terraform_data" "standard_replacement" {
  input = "standard-payload-v${var.revision}"
  triggers_replace = [
    var.revision
  ]
}

# Inverted replacement: create before destroy => ["create", "delete"]
resource "terraform_data" "create_before_destroy_replacement" {
  input = "cbd-payload-v${var.revision}"
  triggers_replace = [
    var.revision
  ]

  lifecycle {
    create_before_destroy = true
  }
}

# Unchanged resource for comparison => ["no-op"]
resource "terraform_data" "stable" {
  input = "constant-data"
}

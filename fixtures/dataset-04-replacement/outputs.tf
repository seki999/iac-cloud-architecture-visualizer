output "standard_id" {
  value = terraform_data.standard_replacement.id
}

output "cbd_id" {
  value = terraform_data.create_before_destroy_replacement.id
}

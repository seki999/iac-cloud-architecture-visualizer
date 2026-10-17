# Multi-provider parsing fixture. Never apply; all provider credentials are mocks.
# Supplied JSON is synthetic, not claimed to be output of this HCL.
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 5.0" }
    google  = { source = "hashicorp/google", version = "~> 6.0" }
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
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
provider "google" {
  project      = "fixture-project"
  region       = "us-central1"
  access_token = "mock-token-not-a-real-credential"
}
provider "azurerm" {
  features {}
  subscription_id                 = "00000000-0000-0000-0000-000000000001"
  tenant_id                       = "00000000-0000-0000-0000-000000000002"
  client_id                       = "00000000-0000-0000-0000-000000000003"
  client_secret                   = "mock-secret-not-a-real-credential"
  resource_provider_registrations = "none"
  skip_provider_registration      = true
}
resource "aws_vpc" "supported_vpc" {
  cidr_block = "10.90.0.0/16"
  tags       = { Name = "ds09-supported-vpc" }
}
resource "google_compute_instance" "custom_gcp" {
  name         = "demo-gcp-instance"
  machine_type = "e2-medium"
  zone         = "us-central1-a"
  boot_disk {
    initialize_params { image = "debian-cloud/debian-12" }
  }
  network_interface { network = "default" }
}
resource "azurerm_virtual_network" "custom_azure" {
  name                = "demo-azure-vnet"
  location            = "eastus"
  resource_group_name = "fixture-resource-group"
  address_space       = ["10.91.0.0/16"]
}

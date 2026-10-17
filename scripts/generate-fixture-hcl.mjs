import { readFileSync, writeFileSync } from "node:fs";
// Synthetic inputs remain synthetic; this creates corresponding plan-only HCL, never deploys it.
const base = "fixtures/dataset-08-large/";
const resources = JSON.parse(readFileSync(base + "state.json", "utf8")).values.root_module.resources;
const ids = new Map(resources.map((r) => [r.values.id, r]));
const groups = new Map(resources.filter((r) => r.type === "aws_db_subnet_group").map((r) => [r.name, r]));
function value(v, key = "") {
  if (typeof v === "string") {
    const linked = key === "db_subnet_group_name" ? groups.get(v) : ids.get(v);
    if (linked)
      return `${linked.address}.${key === "db_subnet_group_name" ? "name" : key.endsWith("_arn") ? "arn" : "id"}`;
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return `[${v.map((x) => value(x, key)).join(", ")}]`;
  if (v && typeof v === "object")
    return `{ ${Object.entries(v)
      .map(([k, x]) => `${JSON.stringify(k)} = ${value(x, k)}`)
      .join(", ")} }`;
  return String(v);
}
const blockKeys = new Set(["route", "default_action", "load_balancer", "network_configuration"]);
function body(obj, indent = "  ") {
  return Object.entries(obj)
    .map(([k, v]) => {
      if (blockKeys.has(k))
        return (Array.isArray(v) ? v : [v])
          .map((x) => `${indent}${k} {\n${body(x, indent + "  ")}\n${indent}}`)
          .join("\n");
      return `${indent}${k} = ${value(v, k)}`;
    })
    .join("\n");
}
const header = `# Synthetic 200-resource plan-only architecture. NEVER apply this fixture.\n# JSON files remain synthetic: they are not advertised as output of this HCL.\nterraform {\n  required_version = ">= 1.5.0"\n  required_providers {\n    aws = { source = "hashicorp/aws", version = "~> 5.0" }\n  }\n}\nprovider "aws" {\n  region = "ap-northeast-1"\n  access_key = "mock_access_key"\n  secret_key = "mock_secret_key"\n  skip_credentials_validation = true\n  skip_requesting_account_id = true\n  skip_metadata_api_check = true\n  skip_region_validation = true\n}\n`;
const lines = [header];
for (const resource of resources) {
  const attrs = { ...resource.values };
  delete attrs.id;
  delete attrs.arn;
  if (resource.type === "aws_route_table_association") delete attrs.tags;
  if (resource.type === "aws_nat_gateway") attrs.allocation_id = "eipalloc-0123456789abcdef0";
  if (resource.type === "aws_lb_target_group") {
    attrs.name = `fixture-${resource.name.replaceAll("_", "-")}`;
  }
  if (resource.type === "aws_db_instance")
    Object.assign(attrs, {
      allocated_storage: 20,
      username: "fixture_admin",
      password: "TEST_PASSWORD_NOT_REAL_12345",
      skip_final_snapshot: true,
    });
  if (resource.type === "aws_ecs_service")
    Object.assign(attrs, {
      name: resource.name,
      task_definition: "arn:aws:ecs:ap-northeast-1:123456789012:task-definition/fixture:1",
      launch_type: "FARGATE",
    });
  lines.push(`resource "${resource.type}" "${resource.name}" {\n${body(attrs)}\n}`);
}
writeFileSync(base + "main.tf", lines.join("\n\n") + "\n");
writeFileSync(
  base + "variables.tf",
  "# All settings are local mock constants. Never deploy this configuration.\n",
);
writeFileSync(base + "outputs.tf", 'output "resource_count" { value = 200 }\n');
console.log("Wrote plan-only 200-resource HCL; no Terraform command executed.");

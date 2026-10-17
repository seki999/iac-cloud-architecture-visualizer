/**
 * Deterministically generates dataset-08-large with exactly 200 resources
 * adhering to the official Terraform State & Plan JSON schemas.
 *
 * Resources composition:
 * - 2 VPCs (vpc-0, vpc-1)
 * - 8 Subnets (4 per VPC across 2 AZs)
 * - 2 Internet Gateways (1 per VPC)
 * - 2 NAT Gateways (1 per VPC)
 * - 4 Route Tables
 * - 8 Route Table Associations
 * - 40 Security Groups (20 per VPC)
 * - 40 Security Group Rules
 * - 40 EC2 Instances (distributed across subnets and SGs)
 * - 4 Application Load Balancers
 * - 8 Target Groups
 * - 8 LB Listeners
 * - 10 S3 Buckets
 * - 10 RDS DB Instances
 * - 10 DB Subnet Groups
 * - 10 ECS Clusters
 * - 12 ECS Services
 * Total: 2 + 8 + 2 + 2 + 4 + 8 + 40 + 40 + 40 + 4 + 8 + 8 + 10 + 10 + 10 + 10 + 12 = 218 -> Let's make exactly 200.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const outDir = join(root, "fixtures", "dataset-08-large");
mkdirSync(outDir, { recursive: true });

const resources = [];

function addRes(type, name, values = {}) {
  const address = `${type}.${name}`;
  resources.push({
    address,
    mode: "managed",
    type,
    name,
    provider_name: "registry.terraform.io/hashicorp/aws",
    schema_version: 1,
    values: {
      id: `${type}-${name}-id`,
      tags: { Name: name },
      ...values,
    },
    sensitive_values: {},
  });
}

// 2 VPCs
for (let v = 0; v < 2; v++) {
  addRes("aws_vpc", `vpc_${v}`, {
    cidr_block: `10.${v + 100}.0.0/16`,
    enable_dns_hostnames: true,
  });
}

// 8 Subnets (4 per VPC)
for (let v = 0; v < 2; v++) {
  for (let s = 0; s < 4; s++) {
    const az = s % 2 === 0 ? "ap-northeast-1a" : "ap-northeast-1c";
    addRes("aws_subnet", `subnet_v${v}_s${s}`, {
      vpc_id: `aws_vpc-vpc_${v}-id`,
      cidr_block: `10.${v + 100}.${s}.0/24`,
      availability_zone: az,
    });
  }
}

// 2 IGWs
for (let v = 0; v < 2; v++) {
  addRes("aws_internet_gateway", `igw_v${v}`, {
    vpc_id: `aws_vpc-vpc_${v}-id`,
  });
}

// 2 NATs
for (let v = 0; v < 2; v++) {
  addRes("aws_nat_gateway", `nat_v${v}`, {
    subnet_id: `aws_subnet-subnet_v${v}_s0-id`,
  });
}

// 4 Route Tables
for (let v = 0; v < 2; v++) {
  addRes("aws_route_table", `rt_pub_v${v}`, { vpc_id: `aws_vpc-vpc_${v}-id` });
  addRes("aws_route_table", `rt_priv_v${v}`, { vpc_id: `aws_vpc-vpc_${v}-id` });
}

// 8 Route Table Associations
for (let v = 0; v < 2; v++) {
  for (let s = 0; s < 4; s++) {
    const isPub = s < 2;
    addRes("aws_route_table_association", `rta_v${v}_s${s}`, {
      subnet_id: `aws_subnet-subnet_v${v}_s${s}-id`,
      route_table_id: isPub ? `aws_route_table-rt_pub_v${v}-id` : `aws_route_table-rt_priv_v${v}-id`,
    });
  }
}

// 30 Security Groups
for (let i = 0; i < 30; i++) {
  const v = i % 2;
  addRes("aws_security_group", `sg_${i}`, {
    vpc_id: `aws_vpc-vpc_${v}-id`,
    description: `Security group ${i}`,
  });
}

// 36 EC2 instances
for (let i = 0; i < 36; i++) {
  const s = i % 4;
  const sg = i % 30;
  const v = i % 2;
  addRes("aws_instance", `app_vm_${i}`, {
    ami: "ami-0123456789abcdef0",
    instance_type: "t3.micro",
    subnet_id: `aws_subnet-subnet_v${v}_s${s}-id`,
    vpc_security_group_ids: [`aws_security_group-sg_${sg}-id`],
  });
}

// 20 S3 Buckets
for (let i = 0; i < 20; i++) {
  addRes("aws_s3_bucket", `data_bucket_${i}`, {
    bucket: `benchmark-bucket-${i}`,
  });
}

// 10 RDS DB Subnet Groups
for (let i = 0; i < 10; i++) {
  const v = i % 2;
  addRes("aws_db_subnet_group", `dbsng_${i}`, {
    name: `dbsng_${i}`,
    subnet_ids: [`aws_subnet-subnet_v${v}_s0-id`, `aws_subnet-subnet_v${v}_s1-id`],
  });
}

// 10 RDS DB Instances
for (let i = 0; i < 10; i++) {
  addRes("aws_db_instance", `rds_${i}`, {
    engine: "postgres",
    instance_class: "db.t4g.micro",
    db_subnet_group_name: `dbsng_${i}`,
    vpc_security_group_ids: [`aws_security_group-sg_${i}-id`],
  });
}

// 10 ALBs
for (let i = 0; i < 10; i++) {
  const v = i % 2;
  addRes("aws_lb", `alb_${i}`, {
    load_balancer_type: "application",
    subnets: [`aws_subnet-subnet_v${v}_s0-id`, `aws_subnet-subnet_v${v}_s1-id`],
    security_groups: [`aws_security_group-sg_${i}-id`],
  });
}

// 10 Target Groups
for (let i = 0; i < 10; i++) {
  const v = i % 2;
  addRes("aws_lb_target_group", `tg_${i}`, {
    vpc_id: `aws_vpc-vpc_${v}-id`,
    port: 8080,
    protocol: "HTTP",
    target_type: "instance",
  });
}

// 10 LB Listeners
for (let i = 0; i < 10; i++) {
  addRes("aws_lb_listener", `listener_${i}`, {
    load_balancer_arn: `aws_lb-alb_${i}-id`,
    port: 80,
    default_action: [{ type: "forward", target_group_arn: `aws_lb_target_group-tg_${i}-id` }],
  });
}

// 10 ECS Clusters
for (let i = 0; i < 10; i++) {
  addRes("aws_ecs_cluster", `ecs_cluster_${i}`, {
    name: `cluster-${i}`,
  });
}

// Current count check:
// 2 + 8 + 2 + 2 + 4 + 8 + 30 + 36 + 20 + 10 + 10 + 10 + 10 + 10 + 10 = 172.
// We need exactly 200 resources, so add 28 ECS Services!
for (let i = 0; i < 28; i++) {
  const c = i % 10;
  const tg = i % 10;
  const s = i % 4;
  const v = i % 2;
  addRes("aws_ecs_service", `ecs_service_${i}`, {
    cluster: `aws_ecs_cluster-ecs_cluster_${c}-id`,
    desired_count: 2,
    load_balancer: [
      {
        target_group_arn: `aws_lb_target_group-tg_${tg}-id`,
        container_name: "app",
        container_port: 8080,
      },
    ],
    network_configuration: {
      subnets: [`aws_subnet-subnet_v${v}_s${s}-id`],
    },
  });
}

console.log(`Generated resource count: ${resources.length}`);
if (resources.length !== 200) {
  throw new Error(`Expected exactly 200 resources, got ${resources.length}`);
}

const stateJson = {
  format_version: "1.0",
  terraform_version: "1.16.2",
  values: {
    root_module: {
      resources,
    },
  },
};

const planJson = {
  format_version: "1.2",
  terraform_version: "1.16.2",
  planned_values: {
    root_module: {
      resources,
    },
  },
  resource_changes: resources.map((r) => ({
    address: r.address,
    mode: r.mode,
    type: r.type,
    name: r.name,
    provider_name: r.provider_name,
    change: {
      actions: ["create"],
      before: null,
      after: r.values,
      after_unknown: {},
      before_sensitive: false,
      after_sensitive: {},
    },
  })),
};

writeFileSync(join(outDir, "state.json"), JSON.stringify(stateJson, null, 2) + "\n");
writeFileSync(join(outDir, "plan.json"), JSON.stringify(planJson, null, 2) + "\n");
writeFileSync(
  join(outDir, "PROVENANCE.json"),
  JSON.stringify(
    {
      "state.json": { origin: "synthetic-generator", count: 200, rule: "scripts/generate-dataset-08.mjs" },
      "plan.json": { origin: "synthetic-generator", count: 200, rule: "scripts/generate-dataset-08.mjs" },
    },
    null,
    2,
  ) + "\n",
);
console.log("dataset-08-large generated successfully.");

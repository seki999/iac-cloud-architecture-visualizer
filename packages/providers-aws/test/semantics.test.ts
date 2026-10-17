import { describe, it, expect } from "vitest";
import { parseTerraformJson } from "@iacviz/terraform-adapter";
import { extractAwsRelationships, classifySubnets } from "@iacviz/providers-aws";
import { buildViewModel } from "@iacviz/architecture-intelligence";
const r = (type: string, name: string, values: Record<string, unknown>, provider = "aws") => ({
  address: `${type}.${name}`,
  type,
  name,
  provider_name: `registry.terraform.io/hashicorp/${provider}`,
  values,
});
const parse = (resources: unknown[]) =>
  parseTerraformJson(JSON.stringify({ format_version: "1.0", values: { root_module: { resources } } }));
const network = () => [
  r("aws_vpc", "v", { id: "vpc-1" }),
  r("aws_subnet", "a", { id: "subnet-a", vpc_id: "vpc-1", availability_zone: "ap-northeast-1a" }),
  r("aws_subnet", "b", { id: "subnet-b", vpc_id: "vpc-1", availability_zone: "ap-northeast-1c" }),
];
const tuples = (g: ReturnType<typeof parse>) => {
  const byId = new Map(g.nodes.map((n) => [n.id, n.address]));
  return extractAwsRelationships(g).map((e) => [byId.get(e.source), e.type, byId.get(e.target)]);
};
describe("AWS semantics regression contracts", () => {
  it("follows weighted listener rules and ignores zero-weight targets", () => {
    const g = parse([
      r("aws_lb", "a", { arn: "arn:alb" }),
      r("aws_lb_listener", "l", { arn: "arn:listener", load_balancer_arn: "arn:alb" }),
      r("aws_lb_target_group", "blue", { arn: "arn:blue" }),
      r("aws_lb_target_group", "green", { arn: "arn:green" }),
      r("aws_lb_listener_rule", "weighted", {
        listener_arn: "arn:listener",
        action: [
          {
            type: "forward",
            forward: [
              {
                target_group: [
                  { arn: "arn:blue", weight: 100 },
                  { arn: "arn:green", weight: 0 },
                ],
              },
            ],
          },
        ],
      }),
    ]);
    const edges = tuples(g);
    expect(edges).toContainEqual(["aws_lb.a", "targets", "aws_lb_target_group.blue"]);
    expect(edges).not.toContainEqual(["aws_lb.a", "targets", "aws_lb_target_group.green"]);
  });
  it("does not treat redirect/fixed-response actions as target forwarding", () => {
    const g = parse([
      r("aws_lb", "a", { arn: "arn:alb" }),
      r("aws_lb_target_group", "x", { arn: "arn:tg" }),
      r("aws_lb_listener", "l", {
        load_balancer_arn: "arn:alb",
        default_action: [{ type: "redirect", target_group_arn: "arn:tg" }],
      }),
    ]);
    expect(tuples(g).some((e) => e[1] === "targets")).toBe(false);
  });
  it("uses typed unique identities and never picks the last duplicate ID", () => {
    const g = parse([
      r("aws_subnet", "a", { id: "subnet-same" }),
      r("aws_subnet", "b", { id: "subnet-same" }),
      r("aws_instance", "x", { subnet_id: "subnet-same" }),
    ]);
    expect(tuples(g).some((e) => e.includes("aws_instance.x"))).toBe(false);
  });
  it("ignores tag values that resemble provider binding attributes", () => {
    const g = parse([
      r("aws_subnet", "a", { id: "subnet-a" }),
      r("aws_instance", "x", { tags: { subnet_id: "subnet-a" } }),
    ]);
    expect(tuples(g)).toEqual([]);
  });
  it("never applies AWS rules to a different provider", () => {
    const g = parse([
      r("aws_subnet", "a", { id: "subnet-a" }, "custom"),
      r("aws_instance", "x", { subnet_id: "subnet-a" }, "custom"),
    ]);
    expect(tuples(g)).toEqual([]);
  });
  it("places subnet_mapping ALBs and block-array ECS services at their common VPC", () => {
    const g = parse([
      ...network(),
      r("aws_lb", "a", { subnet_mapping: [{ subnet_id: "subnet-a" }, { subnet_id: "subnet-b" }] }),
      r("aws_ecs_service", "svc", { network_configuration: [{ subnets: ["subnet-a", "subnet-b"] }] }),
    ]);
    const view = buildViewModel(g, { view: "network" });
    const vpc = view.nodes.find((n) => n.resourceType === "aws_vpc")!;
    for (const type of ["aws_lb", "aws_ecs_service"]) {
      const node = view.nodes.find((n) => n.resourceType === type)!;
      expect(node.layoutParentId).toBe(vpc.id);
      expect(node.semanticScope?.subnetIds).toHaveLength(2);
    }
  });
  it("places RDS through the full DB subnet group membership", () => {
    const g = parse([
      ...network(),
      r("aws_db_subnet_group", "group", { name: "actual-db-name", subnet_ids: ["subnet-a", "subnet-b"] }),
      r("aws_db_instance", "db", { db_subnet_group_name: "actual-db-name" }),
    ]);
    const view = buildViewModel(g, { view: "network" });
    expect(view.nodes.find((n) => n.resourceType === "aws_db_instance")?.layoutParentId).toBe(
      view.nodes.find((n) => n.resourceType === "aws_vpc")?.id,
    );
    expect(
      view.nodes.find((n) => n.resourceType === "aws_db_instance")?.semanticScope?.subnetIds,
    ).toHaveLength(2);
  });
  it("never substitutes Terraform block names for cloud subnet group names", () => {
    const g = parse([
      r("aws_db_subnet_group", "fake", { name: "real-name" }),
      r("aws_db_instance", "db", { db_subnet_group_name: "fake" }),
    ]);
    expect(tuples(g)).toEqual([]);
  });
  it("does not place a partially resolved multi-subnet resource into a known VPC", () => {
    const g = parse([...network(), r("aws_lb", "a", { subnets: ["subnet-a", "missing-subnet"] })]);
    expect(
      buildViewModel(g, { view: "network" }).nodes.find((n) => n.resourceType === "aws_lb")?.layoutParentId,
    ).toBeUndefined();
  });
  it("classifies unknown-ID subnet routes through explicit configuration evidence", () => {
    const resources = [
      r("aws_vpc", "v", {}),
      r("aws_subnet", "a", {}),
      r("aws_route_table", "rt", { route: [{ cidr_block: "0.0.0.0/0", gateway_id: "igw-123" }] }),
      r("aws_route_table_association", "bind", {}),
    ];
    const g = parseTerraformJson(
      JSON.stringify({
        format_version: "1.0",
        planned_values: { root_module: { resources } },
        configuration: {
          root_module: {
            resources: resources.map((n) => ({
              ...n,
              expressions:
                n.type === "aws_subnet"
                  ? { vpc_id: { references: ["aws_vpc.v.id"] } }
                  : n.type === "aws_route_table_association"
                    ? {
                        subnet_id: { references: ["aws_subnet.a.id"] },
                        route_table_id: { references: ["aws_route_table.rt.id"] },
                      }
                    : {},
            })),
          },
        },
      }),
    );
    const enriched = { ...g, edges: [...g.edges, ...extractAwsRelationships(g)] };
    expect(classifySubnets(enriched).get("aws_subnet.a")?.ipv4Class).toBe("public");
    const view = buildViewModel(g, { view: "network" });
    expect(view.nodes.find((n) => n.resourceType === "aws_subnet")?.layoutParentId).toBe(
      view.nodes.find((n) => n.resourceType === "aws_vpc")?.id,
    );
  });
});

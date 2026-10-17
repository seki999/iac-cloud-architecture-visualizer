import { it, expect } from "vitest";
import { parseTerraformJson } from "@iacviz/terraform-adapter";
import { buildViewModel } from "@iacviz/architecture-intelligence";
function sample(owned = true, differentSubnet = false) {
  const r = (type: string, name: string, values: Record<string, unknown>) => ({
    address: `${type}.${name}`,
    type,
    name,
    provider_name: "registry.terraform.io/hashicorp/aws",
    values,
  });
  return parseTerraformJson(
    JSON.stringify({
      format_version: "1.0",
      values: {
        root_module: {
          resources: [
            r("aws_vpc", "v", { id: "v" }),
            r("aws_subnet", "s", { id: "s", vpc_id: "v" }),
            r("aws_subnet", "other", { id: "other", vpc_id: "v" }),
            r("aws_autoscaling_group", "app", { id: "asg", name: "app" }),
            ...Array.from({ length: 2 }, (_, i) =>
              r("aws_instance", `web${i}`, {
                id: `i-${i}`,
                instance_type: "t3.micro",
                subnet_id: i === 1 && differentSubnet ? "other" : "s",
                tags: owned ? { "aws:autoscaling:groupName": "app" } : { Name: "same-name" },
              }),
            ),
          ],
        },
      },
    }),
  );
}
it("aggregates only explicit same-subnet ASG peers and retains addresses", () => {
  const g = sample();
  const view = buildViewModel(g, { view: "overview" });
  const group = view.nodes.find((n) => n.isAggregated)!;
  expect(group.aggregatedAddresses).toEqual(["aws_instance.web0", "aws_instance.web1"]);
  expect(g.nodes.filter((n) => n.resourceType === "aws_instance")).toHaveLength(2);
  const ids = new Set(view.nodes.map((n) => n.id));
  expect(view.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
});
it("Network keeps individual members", () =>
  expect(
    buildViewModel(sample(), { view: "network" }).nodes.filter((n) => n.resourceType === "aws_instance"),
  ).toHaveLength(2));
it("similar names do not establish ownership", () =>
  expect(buildViewModel(sample(false), { view: "overview" }).nodes.some((n) => n.isAggregated)).toBe(false));
it("different subnets remain distinct", () =>
  expect(buildViewModel(sample(true, true), { view: "overview" }).nodes.some((n) => n.isAggregated)).toBe(
    false,
  ));
it("aggregates across AZs only when the owning ASG explicitly spans every member subnet", () => {
  const g = sample(true, true);
  const owner = g.nodes.find((n) => n.resourceType === "aws_autoscaling_group")!;
  owner.attributes.vpc_zone_identifier = ["s", "other"];
  for (const n of g.nodes.filter((n) => n.resourceType === "aws_subnet"))
    n.attributes.availability_zone = n.attributes.id === "s" ? "ap-northeast-1a" : "ap-northeast-1c";
  const overview = buildViewModel(g, { view: "overview" });
  const group = overview.nodes.find((n) => n.isAggregated)!;
  expect(group).toBeDefined();
  expect(group.semanticScope?.subnetIds).toEqual(["other", "s"]);
  expect(group.semanticScope?.availabilityZones).toHaveLength(2);
  expect(group.layoutParentId).toBe(overview.nodes.find((n) => n.resourceType === "aws_vpc")!.id);
  expect(group.metadata).not.toHaveProperty("id");
  expect(
    buildViewModel(g, { view: "network" }).nodes.filter((n) => n.resourceType === "aws_instance"),
  ).toHaveLength(2);
});
it("does not aggregate across different VPCs despite a reused ASG tag", () => {
  const g = sample(true, true);
  g.nodes.find((n) => n.resourceType === "aws_autoscaling_group")!.attributes.vpc_zone_identifier = [
    "s",
    "other",
  ];
  g.nodes.find((n) => n.resourceType === "aws_subnet" && n.attributes.id === "other")!.attributes.vpc_id =
    "missing-vpc";
  expect(buildViewModel(g, { view: "overview" }).nodes.some((n) => n.isAggregated)).toBe(false);
});

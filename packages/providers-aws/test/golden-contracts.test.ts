import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseTerraformJson } from "@iacviz/terraform-adapter";
import { extractAwsRelationships } from "@iacviz/providers-aws";
import { buildViewModel } from "@iacviz/architecture-intelligence";
import { AZ_GROUP_TYPE } from "@iacviz/schemas";
const contracts = JSON.parse(
  readFileSync("fixtures/semantic-contracts.json", "utf8").replace(/^\uFEFF/, ""),
) as { datasets: Array<{ directory: string; nodeCount: number; required: string[][] }> };
for (const contract of contracts.datasets)
  it(`${contract.directory}: satisfies independent resource and relation contracts`, () => {
    const g = parseTerraformJson(readFileSync(`fixtures/${contract.directory}/plan.json`, "utf8"));
    expect(g.nodes).toHaveLength(contract.nodeCount);
    const edges = [...g.edges, ...extractAwsRelationships(g)];
    const lookup = new Map(g.nodes.map((n) => [n.id, n.address]));
    const relations = edges.map((e) => [lookup.get(e.source), e.type, lookup.get(e.target)]);
    for (const expected of contract.required) expect(relations).toContainEqual(expected);
    expect(edges.every((e) => e.type !== "possible_network_access")).toBe(true);
    expect(edges.every((e) => e.evidence.length > 0)).toBe(true);
    const network = buildViewModel(g, { view: "network" });
    // Every resource is drawn exactly once; AZ frames are the only synthetic, address-less nodes.
    const resourceNodes = network.nodes.filter((n) => n.resourceType !== AZ_GROUP_TYPE);
    expect(resourceNodes.map((n) => n.id).sort()).toEqual(g.nodes.map((n) => n.id).sort());
    expect(
      network.nodes.filter((n) => n.resourceType === AZ_GROUP_TYPE).every((n) => n.resourceAddress === ""),
    ).toBe(true);
    if (contract.directory === "dataset-09-unsupported") {
      expect(edges).toHaveLength(0);
      expect(network.warnings.some((w) => w.includes("generic"))).toBe(true);
    }
    if (contract.directory === "dataset-03-unknown") {
      const worker = g.nodes.find((n) => n.address === "aws_instance.worker")!,
        bucket = g.nodes.find((n) => n.address === "aws_s3_bucket.data")!;
      expect(
        edges
          .filter((e) => e.source === worker.id && e.target === bucket.id)
          .every((e) => e.type === "depends_on"),
      ).toBe(true);
    }
    if (contract.directory === "dataset-08-large") {
      expect(
        edges.filter((e) => e.type === "targets" && lookup.get(e.source)?.startsWith("aws_lb.alb_")).length,
      ).toBe(10);
      expect(
        edges.filter((e) => e.type === "targets" && lookup.get(e.target)?.startsWith("aws_ecs_service."))
          .length,
      ).toBe(28);
      expect(
        edges.filter(
          (e) =>
            lookup.get(e.source)?.startsWith("aws_db_instance.") &&
            lookup.get(e.target)?.startsWith("aws_db_subnet_group."),
        ).length,
      ).toBe(10);
    }
  });

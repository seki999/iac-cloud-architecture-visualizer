import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { parseTerraformJson } from "@iacviz/terraform-adapter";
import { buildViewModel } from "@iacviz/architecture-intelligence";
import { layoutViewModel } from "@iacviz/layout";
import { renderDrawioXml } from "@iacviz/renderer-drawio";
import { AWS_ICONS, classifySubnets, getAwsIcon } from "@iacviz/providers-aws";
import { AZ_GROUP_TYPE } from "@iacviz/schemas";

type XmlObject = Record<string, string | undefined> & { mxCell: Record<string, string> };

const load = (dataset: string) => parseTerraformJson(readFileSync(`fixtures/${dataset}/plan.json`, "utf8"));

describe("Network view AZ frames", () => {
  it("groups subnets only by their recorded availability_zone and adds no edges", () => {
    const graph = load("dataset-01-network");
    const view = buildViewModel(graph, { view: "network" });
    const azs = view.nodes.filter((n) => n.resourceType === AZ_GROUP_TYPE);
    const subnets = view.nodes.filter((n) => n.resourceType === "aws_subnet");
    expect(azs.length).toBeGreaterThanOrEqual(2);
    for (const subnet of subnets) {
      const recorded = graph.nodes.find((n) => n.id === subnet.id)!.attributes["availability_zone"];
      const frame = azs.find((a) => a.id === subnet.layoutParentId);
      expect(frame?.label).toBe(recorded);
    }
    expect(view.edges.some((e) => azs.some((a) => a.id === e.source || a.id === e.target))).toBe(false);
    expect(azs.every((a) => a.metadata["synthetic"] === true)).toBe(true);
  });

  it("leaves subnets with an unknown AZ directly in their VPC", () => {
    const graph = load("dataset-01-network");
    for (const node of graph.nodes)
      if (node.resourceType === "aws_subnet") delete node.attributes["availability_zone"];
    const view = buildViewModel(graph, { view: "network" });
    expect(view.nodes.some((n) => n.resourceType === AZ_GROUP_TYPE)).toBe(false);
  });

  it("Overview never creates AZ frames", () => {
    const view = buildViewModel(load("dataset-01-network"), { view: "overview" });
    expect(view.nodes.some((n) => n.resourceType === AZ_GROUP_TYPE)).toBe(false);
  });

  it("does not draw IaC-only references or depends_on edges", () => {
    for (const view of ["overview", "network"] as const) {
      const model = buildViewModel(load("dataset-03-unknown"), { view });
      expect(model.edges.some((e) => e.type === "references" || e.type === "depends_on")).toBe(false);
    }
  });

  it("lays AZ frames side by side and aligns subnets of the same routing class", async () => {
    const model = await layoutViewModel(buildViewModel(load("dataset-01-network"), { view: "network" }));
    const azs = model.nodes.filter((n) => n.resourceType === AZ_GROUP_TYPE).sort((a, b) => a.x! - b.x!);
    expect(new Set(azs.map((a) => a.y)).size).toBe(1);
    for (let i = 1; i < azs.length; i++)
      expect(azs[i]!.x!).toBeGreaterThanOrEqual(azs[i - 1]!.x! + azs[i - 1]!.width!);
    const rowsByTier = new Map<string, Set<number>>();
    for (const subnet of model.nodes.filter((n) => n.resourceType === "aws_subnet")) {
      const rows = rowsByTier.get(subnet.tier ?? "unknown") ?? new Set<number>();
      rows.add(subnet.y!);
      rowsByTier.set(subnet.tier ?? "unknown", rows);
    }
    // dataset 01 has one subnet per class per AZ, so each class occupies exactly one row.
    for (const rows of rowsByTier.values()) expect(rows.size).toBe(1);
    const again = await layoutViewModel(buildViewModel(load("dataset-01-network"), { view: "network" }));
    expect(again.nodes.map((n) => [n.id, n.x, n.y, n.width, n.height])).toEqual(
      model.nodes.map((n) => [n.id, n.x, n.y, n.width, n.height]),
    );
  });
});

describe("draw.io AWS icons", () => {
  it("only references verified aws4 stencils and attaches icons as children of resource cards", async () => {
    for (const icon of Object.values(AWS_ICONS)) expect(icon.stencil).toMatch(/^mxgraph\.aws4\.[a-z0-9_]+$/);
    const model = await layoutViewModel(buildViewModel(load("dataset-02-three-tier"), { view: "network" }));
    const xml = renderDrawioXml(model);
    const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(xml);
    const objects = [parsed.mxfile.diagram.mxGraphModel.root.object].flat() as XmlObject[];
    const icons = objects.filter((o) => o["@_decorative"] === "aws-icon");
    const ids = new Set(objects.map((o) => o["@_id"]));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(ids.has(icon.mxCell["@_parent"])).toBe(true);
      expect(icon.mxCell["@_style"]).toContain("connectable=0");
      expect(icon["@_terraform_address"]).toBeUndefined();
    }
    const withIcon = model.nodes.filter((n) => !n.isContainer && getAwsIcon(n.iconKey)).length;
    expect(icons).toHaveLength(withIcon);
    const index = new Map(objects.map((o, i) => [o["@_id"], i]));
    for (const icon of icons)
      expect(index.get(icon.mxCell["@_parent"])!).toBeLessThan(index.get(icon["@_id"])!);
  });

  it("renders unknown icon keys as plain cards without an icon cell", () => {
    expect(getAwsIcon("aws.generic")).toBeUndefined();
    expect(getAwsIcon("aws.not_a_service")).toBeUndefined();
  });
});

describe("plan subnet classification through count association blocks", () => {
  it("deduces route tables as inferred when associations cover the subnet collection one-to-one", () => {
    const classes = classifySubnets(load("dataset-01-network"));
    expect(classes.get("aws_subnet.public[0]")).toMatchObject({
      overallClass: "public",
      knowledge: "inferred",
    });
    expect(classes.get("aws_subnet.private[1]")).toMatchObject({
      ipv4Class: "private-nat-egress",
      overallClass: "private-nat-egress",
      knowledge: "inferred",
    });
  });

  it("returns unknown when an association is missing from the block", () => {
    const graph = load("dataset-01-network");
    const removed = graph.nodes.find((n) => n.address === "aws_route_table_association.public[1]")!;
    graph.nodes = graph.nodes.filter((n) => n.id !== removed.id);
    graph.edges = graph.edges.filter((e) => e.source !== removed.id && e.target !== removed.id);
    const classes = classifySubnets(graph);
    expect(classes.get("aws_subnet.public[0]")?.overallClass).toBe("unknown");
    expect(classes.get("aws_subnet.public[1]")?.overallClass).toBe("unknown");
  });

  it("returns unknown when associations in the block use different route tables", () => {
    const graph = load("dataset-01-network");
    const assoc = graph.nodes.find((n) => n.address === "aws_route_table_association.public[1]")!;
    const privateTable = graph.nodes.find((n) => n.address === "aws_route_table.private")!;
    for (const edge of graph.edges)
      if (edge.source === assoc.id && edge.evidence.some((e) => e.attributePath === "route_table_id"))
        edge.target = privateTable.id;
    expect(classifySubnets(graph).get("aws_subnet.public[0]")?.overallClass).toBe("unknown");
  });

  it("keeps IPv6 unknown from deciding the class only when the subnet records no IPv6 CIDR", () => {
    const graph = load("dataset-01-network");
    const subnet = graph.nodes.find((n) => n.address === "aws_subnet.private[0]")!;
    delete subnet.attributes["ipv6_cidr_block"];
    expect(classifySubnets(graph).get("aws_subnet.private[0]")?.overallClass).toBe("unknown");
  });
});

describe("plan placement from configuration references", () => {
  const parents = (dataset: string) => {
    const view = buildViewModel(load(dataset), { view: "network" });
    const byId = new Map(view.nodes.map((n) => [n.id, n]));
    return (address: string) => {
      const node = view.nodes.find((n) => n.resourceAddress === address)!;
      return byId.get(node.layoutParentId ?? "")?.resourceAddress;
    };
  };

  it("places an unknown subnet_id that references one subnet instance into that subnet", () => {
    const parentOf = parents("dataset-01-network");
    expect(parentOf("aws_instance.bastion")).toBe("aws_subnet.public[0]");
    expect(parentOf("aws_nat_gateway.main")).toBe("aws_subnet.public[0]");
  });

  it("keeps count.index collection references at the common VPC, never a guessed subnet", () => {
    expect(parents("dataset-01-network")("aws_instance.app[0]")).toBe("aws_vpc.main");
  });

  it("does not treat Terraform's containing-object references as ambiguous", () => {
    const graph = load("dataset-01-network");
    const bastion = graph.nodes.find((n) => n.address === "aws_instance.bastion")!;
    expect(graph.edges.some((e) => e.source === bastion.id && e.knowledge === "unknown")).toBe(false);
  });

  it("records var/local references that resolve to no resource and leaves placement unresolved", () => {
    const graph = load("dataset-01-network");
    const bastion = graph.nodes.find((n) => n.address === "aws_instance.bastion")!;
    bastion.unresolvedReferencePaths = ["subnet_id"];
    const view = buildViewModel(graph, { view: "network" });
    const node = view.nodes.find((n) => n.resourceAddress === "aws_instance.bastion")!;
    const parent = view.nodes.find((n) => n.id === node.layoutParentId);
    expect(parent?.resourceType).not.toBe("aws_subnet");
    expect(
      load("dataset-01-network").nodes.find((n) => n.address === "aws_vpc.main")?.unresolvedReferencePaths,
    ).toEqual(["cidr_block"]);
  });
});

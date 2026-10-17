import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parseTerraformJson, detectInputType } from "@iacviz/terraform-adapter";
import { InfraGraphBuilder, parseResourceAddress, sanitizeAttributes } from "@iacviz/core";
import { extractAwsRelationships, classifySubnets } from "@iacviz/providers-aws";
import { buildViewModel } from "@iacviz/architecture-intelligence";
import { layoutViewModel, fallbackGridLayout } from "@iacviz/layout";
import { renderDrawioXml, validateDrawioXml } from "@iacviz/renderer-drawio";
import { XMLParser } from "fast-xml-parser";

const fixture = (folder: string, file = "plan.json") => readFileSync(`fixtures/${folder}/${file}`, "utf8");
const state = (resources: unknown[]) =>
  JSON.stringify({ format_version: "1.0", values: { root_module: { resources } } });
const resource = (type: string, name: string, values: Record<string, unknown>, sensitive_values = {}) => ({
  address: `${type}.${name}`,
  type,
  name,
  provider_name: "registry.terraform.io/hashicorp/aws",
  values,
  sensitive_values,
});

describe("input and identity", () => {
  it.each(["{", "[]", '{"version":4}', '{"format_version":"2.0"}', '{"format_version":"1x.0"}'])(
    "rejects invalid input %s",
    (input) => expect(() => parseTerraformJson(input)).toThrow(),
  );
  it("accepts compatible minor versions and keeps engine unknown", () => {
    const g = parseTerraformJson(state([]).replace("1.0", "1.99"));
    expect(g.source.engine).toBe("unknown");
    expect(detectInputType(state([])).kind).toBe("state");
  });
  it("does not merge colliding for_each keys", () =>
    expect(InfraGraphBuilder.makeNodeId('aws_instance.x["a.b"]')).not.toBe(
      InfraGraphBuilder.makeNodeId('aws_instance.x["a-b"]'),
    ));
  it("parses dots, escaped keys and nested modules", () => {
    const a = parseResourceAddress(
      'module.x["module.a.b"].module.y[0].aws_instance.web[' + JSON.stringify('a"b') + "]",
    );
    expect(a.moduleAddress).toBe('module.x["module.a.b"].module.y[0]');
    expect(a.index).toBe('a"b');
    expect(a.resourceType).toBe("aws_instance");
  });
  it("supports planned_values without resource_changes", () => {
    const values = JSON.parse(state([resource("aws_vpc", "x", { id: "vpc-1" })])).values;
    expect(
      parseTerraformJson(JSON.stringify({ format_version: "1.0", planned_values: values })).nodes,
    ).toHaveLength(1);
  });
  it("preserves replacement order", () => {
    const g = parseTerraformJson(fixture("dataset-04-replacement"));
    expect(g.nodes.some((n) => JSON.stringify(n.change?.actions) === '["delete","create"]')).toBe(true);
    expect(g.nodes.some((n) => JSON.stringify(n.change?.actions) === '["create","delete"]')).toBe(true);
  });
});

describe("security and AWS semantics", () => {
  it("drops nested sensitive tags and array entries", () => {
    const safe = sanitizeAttributes(
      { tags: { Name: "private" }, subnets: ["subnet-1", "TEST_SECRET_DO_NOT_EXPORT_12345"], password: "pw" },
      { tags: { Name: true } },
    );
    expect(JSON.stringify(safe)).not.toContain("private");
    expect(JSON.stringify(safe)).not.toContain("TEST_SECRET");
    expect(safe).not.toHaveProperty("password");
  });
  it("retains routing attributes and classifies IPv4 and IPv6 separately", () => {
    const g = parseTerraformJson(
      state([
        resource("aws_vpc", "x", { id: "vpc-1" }),
        resource("aws_subnet", "named_private", { id: "subnet-1", vpc_id: "vpc-1" }),
        resource("aws_route_table", "x", {
          id: "rtb-1",
          route: [
            { cidr_block: "0.0.0.0/0", gateway_id: "igw-1" },
            { ipv6_cidr_block: "::/0", egress_only_gateway_id: "eigw-1" },
          ],
        }),
        resource("aws_route_table_association", "x", { subnet_id: "subnet-1", route_table_id: "rtb-1" }),
      ]),
    );
    const c = classifySubnets(g).get("aws_subnet.named_private")!;
    expect(c.ipv4Class).toBe("public");
    expect(c.ipv6Class).toBe("private-hybrid");
  });
  it("resolves ALB listener and ECS target bindings without guessing database traffic", () => {
    const g = parseTerraformJson(
      state([
        resource("aws_lb", "x", { id: "alb", arn: "arn:alb" }),
        resource("aws_lb_target_group", "x", { id: "tg", arn: "arn:tg" }),
        resource("aws_lb_listener", "x", {
          load_balancer_arn: "arn:alb",
          default_action: [{ type: "forward", target_group_arn: "arn:tg" }],
        }),
        resource("aws_ecs_service", "x", { load_balancer: [{ target_group_arn: "arn:tg" }] }),
      ]),
    );
    const edges = extractAwsRelationships(g);
    expect(edges.filter((e) => e.type === "targets")).toHaveLength(2);
    expect(edges.every((e) => e.evidence.length > 0)).toBe(true);
  });
  it("keeps depends_on separate and never creates dangling edges", () => {
    const g = parseTerraformJson(fixture("dataset-03-unknown"));
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(g.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
    expect(g.edges.every((e) => e.type !== "possible_network_access")).toBe(true);
  });
});

for (const folder of readdirSync("fixtures").filter((n) => n.startsWith("dataset-"))) {
  describe(folder, () => {
    for (const file of readdirSync(`fixtures/${folder}`).filter(
      (n) => n === "plan.json" || n === "state.json",
    )) {
      it(`${file}: parses and exports both editable views deterministically`, async () => {
        const g = parseTerraformJson(fixture(folder, file));
        if (file === "plan.json") {
          expect(g).toEqual(JSON.parse(fixture(folder, "expected-graph.json")));
          const lookup = new Map(g.nodes.map((n) => [n.id, n.address]));
          const relations = [...g.edges, ...extractAwsRelationships(g)].map((e) => ({
            source: lookup.get(e.source),
            target: lookup.get(e.target),
            type: e.type,
            knowledge: e.knowledge,
          }));
          expect(relations).toEqual(JSON.parse(fixture(folder, "expected-relations.json")));
        }
        expect(g.nodes.length).toBeGreaterThan(0);
        expect(new Set(g.nodes.map((n) => n.id)).size).toBe(g.nodes.length);
        const views = [];
        for (const view of ["overview", "network"] as const) {
          const first = await layoutViewModel(buildViewModel(g, { view }));
          const second = await layoutViewModel(buildViewModel(g, { view }));
          expect(first).toEqual(second);
          for (const node of first.nodes) {
            expect(Number.isFinite(node.x)).toBe(true);
            expect(node.width).toBeGreaterThan(0);
          }
          const visible = new Set(first.nodes.map((n) => n.id));
          expect(first.edges.every((e) => visible.has(e.source) && visible.has(e.target))).toBe(true);
          views.push(first);
        }
        const xml = renderDrawioXml(views);
        const valid = validateDrawioXml(xml);
        expect(valid.errors).toEqual([]);
        expect(valid.pageCount).toBe(2);
        expect(valid.totalObjects).toBeGreaterThan(0);
        expect(JSON.stringify(g) + xml).not.toContain("TEST_SECRET_DO_NOT_EXPORT_12345");
        const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(xml);
        expect(parsed.mxfile.diagram).toHaveLength(2);
      });
    }
  });
}
it("XML escapes hostile labels and preserves Chinese/Japanese", async () => {
  const g = parseTerraformJson(state([resource("aws_s3_bucket", "中文_日本語", { id: "bucket" })]));
  const view = await layoutViewModel(buildViewModel(g, { view: "overview" }));
  view.nodes[0]!.label = '<img src="https://evil.invalid/a" onerror="evil()"> 中文 日本語';
  const xml = renderDrawioXml(view);
  expect(xml).not.toContain("<img");
  expect(xml).toContain("html=0");
  expect(xml).toContain("中文");
  expect(validateDrawioXml(xml).isValid).toBe(true);
});
it("fallback sizes containers around all children", () => {
  const g = parseTerraformJson(
    state([
      resource("aws_vpc", "x", { id: "vpc-1" }),
      ...Array.from({ length: 20 }, (_, i) =>
        resource("aws_subnet", `s${i}`, { id: `subnet-${i}`, vpc_id: "vpc-1" }),
      ),
    ]),
  );
  const view = fallbackGridLayout(buildViewModel(g, { view: "network" }));
  const parent = view.nodes.find((n) => n.resourceType === "aws_vpc")!;
  for (const child of view.nodes.filter((n) => n.layoutParentId === parent.id))
    expect(child.y! + child.height!).toBeLessThanOrEqual(parent.height!);
});

it("deposed and current objects keep separate stable identities", () => {
  const base = {
    address: "aws_instance.x",
    type: "aws_instance",
    name: "x",
    provider_name: "registry.terraform.io/hashicorp/aws",
  };
  const g = parseTerraformJson(
    JSON.stringify({
      format_version: "1.0",
      resource_changes: [
        { ...base, change: { actions: ["no-op"], after: { id: "i-current" } } },
        { ...base, deposed: "old", change: { actions: ["delete"], after: null, before: { id: "i-old" } } },
      ],
    }),
  );
  expect(g.nodes).toHaveLength(2);
  expect(new Set(g.nodes.map((n) => n.id)).size).toBe(2);
  expect(g.nodes.find((n) => n.change?.deposed)?.attributes.id).toBe("i-old");
});
it("does not classify missing route table data as private", () => {
  const g = parseTerraformJson(
    state([
      resource("aws_subnet", "public_name", { id: "s", vpc_id: "v" }),
      resource("aws_route_table_association", "a", { subnet_id: "s", route_table_id: "missing" }),
    ]),
  );
  expect(classifySubnets(g).get("aws_subnet.public_name")?.overallClass).toBe("unknown");
});
it("scale fixture contains exactly 200 resources", () =>
  expect(parseTerraformJson(fixture("dataset-08-large", "state.json")).nodes).toHaveLength(200));
it("hidden containers reparent visible children without changing scope", () => {
  const g = parseTerraformJson(
    state([
      resource("aws_vpc", "v", { id: "v" }),
      resource("aws_subnet", "s", { id: "s", vpc_id: "v" }),
      resource("aws_instance", "i", { id: "i", subnet_id: "s" }),
    ]),
  );
  const model = buildViewModel(g, {
    view: "network",
    config: {
      schemaVersion: "1.0",
      view: "network",
      layout: { direction: "LEFT_TO_RIGHT", spacing: 40, nodeSpacing: 40 },
      hiddenResourceAddresses: ["aws_subnet.s"],
      collapsedGroups: [],
      manualPositions: {},
      annotations: [],
    },
  });
  const instance = model.nodes.find((n) => n.resourceType === "aws_instance")!;
  expect(instance.layoutParentId).toBe(model.nodes.find((n) => n.resourceType === "aws_vpc")!.id);
  expect(instance.semanticScope?.subnetIds).toHaveLength(1);
});
it("invalid XML control characters are removed before graph export", () => {
  const g = parseTerraformJson(
    state([resource("aws_s3_bucket", "test", { id: "bucket", tags: { Name: "bad\u0000name" } })]),
  );
  expect(JSON.stringify(g)).not.toContain("\\u0000");
});

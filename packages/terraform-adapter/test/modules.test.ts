import { it, expect } from "vitest";
import { parseTerraformJson } from "@iacviz/terraform-adapter";
import { readFileSync } from "node:fs";
const r = (address: string, type: string, name: string) => ({
  address,
  type,
  name,
  provider_name: "registry.terraform.io/hashicorp/aws",
  values: {},
});
it("traces child inputs and output references without copying constants", () => {
  const plan = {
    format_version: "1.0",
    planned_values: {
      root_module: {
        resources: [r("aws_vpc.root", "aws_vpc", "root"), r("aws_instance.web", "aws_instance", "web")],
        child_modules: [
          {
            address: "module.network",
            resources: [r("module.network.aws_subnet.private", "aws_subnet", "private")],
          },
        ],
      },
    },
    configuration: {
      root_module: {
        resources: [
          {
            ...r("aws_instance.web", "aws_instance", "web"),
            expressions: { subnet_id: { references: ["module.network.subnet_id"] } },
          },
        ],
        module_calls: {
          network: {
            expressions: {
              vpc_id: { references: ["aws_vpc.root.id"] },
              secret: { constant_value: "TEST_SECRET_DO_NOT_EXPORT_12345" },
            },
            module: {
              resources: [
                {
                  ...r("aws_subnet.private", "aws_subnet", "private"),
                  expressions: { vpc_id: { references: ["var.vpc_id"] } },
                },
              ],
              outputs: { subnet_id: { expression: { references: ["aws_subnet.private.id"] } } },
            },
          },
        },
      },
    },
  };
  const g = parseTerraformJson(JSON.stringify(plan));
  const lookup = new Map(g.nodes.map((n) => [n.id, n.address]));
  const edges = g.edges.map((e) => [lookup.get(e.source), e.type, lookup.get(e.target)]);
  expect(edges).toContainEqual(["aws_instance.web", "associated_with", "module.network.aws_subnet.private"]);
  expect(edges).toContainEqual(["module.network.aws_subnet.private", "associated_with", "aws_vpc.root"]);
  expect(JSON.stringify(g)).not.toContain("TEST_SECRET");
});
it("resolves explicit module depends_on as IaC dependencies only", () => {
  const g = parseTerraformJson(
    JSON.stringify({
      format_version: "1.0",
      planned_values: {
        root_module: {
          resources: [r("aws_instance.web", "aws_instance", "web")],
          child_modules: [
            {
              address: "module.network",
              resources: [
                r("module.network.aws_subnet.a", "aws_subnet", "a"),
                r("module.network.aws_subnet.b", "aws_subnet", "b"),
              ],
            },
          ],
        },
      },
      configuration: {
        root_module: {
          resources: [{ ...r("aws_instance.web", "aws_instance", "web"), depends_on: ["module.network"] }],
        },
      },
    }),
  );
  expect(g.edges).toHaveLength(2);
  expect(g.edges.every((e) => e.type === "depends_on")).toBe(true);
});
it("resolves dataset 06 VPC module inputs while retaining ambiguous indexed subnet outputs", () => {
  const g = parseTerraformJson(readFileSync("fixtures/dataset-06-modules/plan.json", "utf8"));
  const vpc = g.nodes.find((n) => n.address === "aws_vpc.root_vpc")!;
  for (const subnet of g.nodes.filter((n) => n.resourceType === "aws_subnet"))
    expect(
      g.edges.some((e) => e.source === subnet.id && e.target === vpc.id && e.type === "associated_with"),
    ).toBe(true);
});
it("module output cycles stop safely without inventing resources", () => {
  const g = parseTerraformJson(
    JSON.stringify({
      format_version: "1.0",
      planned_values: { root_module: { resources: [r("aws_instance.web", "aws_instance", "web")] } },
      configuration: {
        root_module: {
          resources: [
            {
              ...r("aws_instance.web", "aws_instance", "web"),
              expressions: { subnet_id: { references: ["module.x.out"] } },
            },
          ],
          module_calls: {
            x: {
              expressions: { v: { references: ["module.x.out"] } },
              module: { outputs: { out: { expression: { references: ["var.v"] } } } },
            },
          },
        },
      },
    }),
  );
  expect(g.edges).toEqual([]);
});

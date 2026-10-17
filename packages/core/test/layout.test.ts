import { it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parseTerraformJson } from "@iacviz/terraform-adapter";
import { buildViewModel } from "@iacviz/architecture-intelligence";
import { layoutViewModel } from "@iacviz/layout";
for (const dataset of [
  "dataset-01-network",
  "dataset-02-three-tier",
  "dataset-07-multi-subnet",
  "dataset-08-large",
]) {
  it(`${dataset} has no sibling overlaps and keeps children inside containers`, async () => {
    const graph = parseTerraformJson(readFileSync(`fixtures/${dataset}/plan.json`, "utf8"));
    const model = await layoutViewModel(buildViewModel(graph, { view: "network" }));
    expect(model.warnings.some((w) => w.includes("ELK layout failed"))).toBe(false);
    const byId = new Map(model.nodes.map((n) => [n.id, n]));
    for (const node of model.nodes) {
      const parent = node.layoutParentId ? byId.get(node.layoutParentId) : undefined;
      if (parent) {
        expect(node.x! + node.width!).toBeLessThanOrEqual(parent.width! + 1);
        expect(node.y! + node.height!).toBeLessThanOrEqual(parent.height! + 1);
        expect(node.y!).toBeGreaterThanOrEqual(52);
      }
      for (const other of model.nodes) {
        if (node.id >= other.id || node.layoutParentId !== other.layoutParentId) continue;
        const overlaps =
          node.x! < other.x! + other.width! - 1 &&
          other.x! < node.x! + node.width! - 1 &&
          node.y! < other.y! + other.height! - 1 &&
          other.y! < node.y! + node.height! - 1;
        expect(overlaps, `${node.resourceAddress} overlaps ${other.resourceAddress}`).toBe(false);
      }
    }
  });
}

it("ELK lays out every dataset in both views without falling back to the grid", async () => {
  const datasets = readdirSync("fixtures").filter((d) => d.startsWith("dataset-"));
  for (const dataset of datasets)
    for (const view of ["overview", "network"] as const) {
      const graph = parseTerraformJson(readFileSync(`fixtures/${dataset}/plan.json`, "utf8"));
      const model = await layoutViewModel(buildViewModel(graph, { view }));
      expect(
        model.warnings.filter((w) => w.includes("ELK layout failed")),
        `${dataset} ${view}`,
      ).toEqual([]);
    }
}, 60_000);

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { parseTerraformJson } from "../packages/terraform-adapter/src/index.ts";
import { extractAwsRelationships } from "../packages/providers-aws/src/index.ts";
const report = [];
for (const folder of readdirSync("fixtures").filter((n) => n.startsWith("dataset-"))) {
  const graph = parseTerraformJson(readFileSync(`fixtures/${folder}/plan.json`, "utf8"));
  const previous = JSON.parse(readFileSync(`fixtures/${folder}/expected-relations.json`, "utf8"));
  const lookup = new Map(graph.nodes.map((n) => [n.id, n.address]));
  const current = [...graph.edges, ...extractAwsRelationships(graph)].map((e) => ({
    source: lookup.get(e.source),
    target: lookup.get(e.target),
    type: e.type,
    knowledge: e.knowledge,
  }));
  const key = (r: unknown) => JSON.stringify(r);
  const oldSet = new Set(previous.map(key));
  const newSet = new Set(current.map(key));
  report.push({
    dataset: folder,
    before: previous.length,
    after: current.length,
    added: current.filter((r) => !oldSet.has(key(r))),
    removed: previous.filter((r: unknown) => !newSet.has(key(r))),
  });
}
writeFileSync("docs/golden-relation-changes.json", JSON.stringify(report, null, 2) + "\n");
for (const row of report)
  console.log(JSON.stringify({ ...row, added: row.added.slice(0, 4), removed: row.removed.slice(0, 4) }));

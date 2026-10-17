import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseTerraformJson } from "../packages/terraform-adapter/src/index.ts";
import { extractAwsRelationships } from "../packages/providers-aws/src/index.ts";
for (const folder of readdirSync("fixtures").filter((n) => n.startsWith("dataset-"))) {
  const base = `fixtures/${folder}`;
  const graph = parseTerraformJson(readFileSync(`${base}/plan.json`, "utf8"));
  writeFileSync(`${base}/expected-graph.json`, JSON.stringify(graph, null, 2) + "\n");
  const lookup = new Map(graph.nodes.map((n) => [n.id, n.address]));
  const relations = [...graph.edges, ...extractAwsRelationships(graph)].map((e) => ({
    source: lookup.get(e.source),
    target: lookup.get(e.target),
    type: e.type,
    knowledge: e.knowledge,
  }));
  writeFileSync(`${base}/expected-relations.json`, JSON.stringify(relations, null, 2) + "\n");
}

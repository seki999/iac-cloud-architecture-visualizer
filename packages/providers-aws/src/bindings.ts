import type { Evidence, InfraGraph, InfraNode, KnowledgeState } from "@iacviz/schemas";

/** Paths traverse Terraform block arrays without treating arbitrary tags as attributes. */
export function valuesAt(value: unknown, path: string): unknown[] {
  const parts = path.split(".");
  function visit(current: unknown, index: number): unknown[] {
    if (Array.isArray(current)) return current.flatMap((v) => visit(v, index));
    if (index === parts.length) return current === undefined || current === null ? [] : [current];
    if (!current || typeof current !== "object") return [];
    return visit((current as Record<string, unknown>)[parts[index]!], index + 1);
  }
  return visit(value, 0);
}
export interface Binding {
  node: InfraNode;
  knowledge: KnowledgeState;
  evidence: Evidence[];
}
export function bindings(graph: InfraGraph, source: InfraNode, path: string, types: string[]): Binding[] {
  if (source.provider !== "aws") return [];
  const result = new Map<string, Binding>();
  for (const value of valuesAt(source.attributes, path)) {
    if (typeof value !== "string" || !value || value === "[SENSITIVE]") continue;
    const candidates = graph.nodes.filter(
      (n) =>
        n.provider === "aws" &&
        !n.change?.deposed &&
        types.includes(n.resourceType) &&
        [n.attributes.id, n.attributes.arn, n.attributes.name].some(
          (id) => typeof id === "string" && id === value,
        ),
    );
    if (candidates.length !== 1) continue;
    const node = candidates[0]!;
    result.set(node.id, {
      node,
      knowledge: "known",
      evidence: [
        {
          source: graph.source.kind === "plan" ? "plan_value" : "state_value",
          resourceAddress: source.address,
          attributePath: path,
          ruleId: "aws.typed-attribute-binding",
          description: "Explicit typed resource attribute binding; not proof of reachability.",
        },
      ],
    });
  }
  for (const edge of graph.edges) {
    if (
      edge.knowledge === "unknown" ||
      edge.source !== source.id ||
      !["references", "associated_with"].includes(edge.type)
    )
      continue;
    const evidence = edge.evidence.filter(
      (e) =>
        e.source === "configuration_reference" &&
        (e.attributePath === path || (!!e.attributePath && path.startsWith(e.attributePath + "."))),
    );
    if (!evidence.length) continue;
    const node = graph.nodes.find(
      (n) =>
        n.id === edge.target && n.provider === "aws" && !n.change?.deposed && types.includes(n.resourceType),
    );
    if (node && !result.has(node.id)) result.set(node.id, { node, knowledge: edge.knowledge, evidence });
  }
  return [...result.values()];
}

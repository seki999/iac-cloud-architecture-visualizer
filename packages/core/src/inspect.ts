import type { InfraGraph } from "@iacviz/schemas";

export interface GraphSummary {
  engine: string;
  kind: string;
  terraformVersion?: string;
  totalResources: number;
  providerCounts: Record<string, number>;
  recognizedAwsResources: number;
  unrecognizedResources: number;
  vpcCount: number;
  subnetCount: number;
  totalRelationships: number;
  relationshipCountsByType: Record<string, number>;
  unknownKnowledgeCount: number;
  warningCount: number;
  warnings: string[];
}

/**
 * Computes a safe statistical summary of an InfraGraph.
 * Strictly guarantees no raw attributes, tokens or passwords are included.
 */
export function inspectGraph(
  graph: InfraGraph,
  recognizedTypes: ReadonlySet<string> = new Set(),
): GraphSummary {
  const providerCounts: Record<string, number> = {};
  const relationshipCountsByType: Record<string, number> = {};

  let recognizedAws = 0;
  let unrecognized = 0;
  let vpcCount = 0;
  let subnetCount = 0;
  let unknownKnowledgeCount = 0;

  for (const node of graph.nodes) {
    providerCounts[node.provider] = (providerCounts[node.provider] ?? 0) + 1;

    if (node.provider === "aws" && recognizedTypes.has(node.resourceType)) {
      recognizedAws++;
    } else {
      unrecognized++;
    }

    if (node.resourceType === "aws_vpc") {
      vpcCount++;
    } else if (node.resourceType === "aws_subnet") {
      subnetCount++;
    }

    if (node.knowledge === "unknown") {
      unknownKnowledgeCount++;
    }
  }

  for (const edge of graph.edges) {
    relationshipCountsByType[edge.type] = (relationshipCountsByType[edge.type] ?? 0) + 1;
    if (edge.knowledge === "unknown") {
      unknownKnowledgeCount++;
    }
  }

  return {
    engine: graph.source.engine,
    kind: graph.source.kind,
    terraformVersion: graph.source.terraformVersion,
    totalResources: graph.nodes.length,
    providerCounts,
    recognizedAwsResources: recognizedAws,
    unrecognizedResources: unrecognized,
    vpcCount,
    subnetCount,
    totalRelationships: graph.edges.length,
    relationshipCountsByType,
    unknownKnowledgeCount,
    warningCount: graph.warnings.length,
    warnings: [...graph.warnings],
  };
}

/**
 * Formats the summary into a clean terminal string.
 */
export function formatGraphSummary(summary: GraphSummary): string {
  const lines: string[] = [];
  lines.push(`IaC Visualizer - Graph Summary`);
  lines.push(`================================`);
  lines.push(`Source Engine:        ${summary.engine} (${summary.kind})`);
  if (summary.terraformVersion) {
    lines.push(`Engine Version:       ${summary.terraformVersion}`);
  }
  lines.push(`Total Resources:      ${summary.totalResources}`);
  lines.push(`  - AWS Recognized:   ${summary.recognizedAwsResources}`);
  lines.push(`  - Generic/Other:    ${summary.unrecognizedResources}`);
  lines.push(`VPCs:                 ${summary.vpcCount}`);
  lines.push(`Subnets:              ${summary.subnetCount}`);
  lines.push(`Total Relationships:  ${summary.totalRelationships}`);
  lines.push(`Unknown States:       ${summary.unknownKnowledgeCount}`);
  lines.push(`Warnings:             ${summary.warningCount}`);

  lines.push(`\nProviders:`);
  for (const [p, c] of Object.entries(summary.providerCounts)) {
    lines.push(`  - ${p}: ${c}`);
  }

  if (Object.keys(summary.relationshipCountsByType).length > 0) {
    lines.push(`\nRelationships:`);
    for (const [rel, c] of Object.entries(summary.relationshipCountsByType)) {
      lines.push(`  - ${rel}: ${c}`);
    }
  }

  if (summary.warnings.length > 0) {
    lines.push(`\nWarnings:`);
    for (const w of summary.warnings) {
      lines.push(`  ! ${w}`);
    }
  }

  return lines.join("\n");
}

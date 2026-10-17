import { aggregateOverview } from "./aggregation.js";
import type { InfraGraph, ViewModel, ViewNode, ViewEdge, DiagramConfig } from "@iacviz/schemas";
import {
  AWS_RESOURCE_RULES,
  getAwsResourceRule,
  classifySubnets,
  extractAwsRelationships,
} from "@iacviz/providers-aws";
import { computePlacements } from "./placement.js";
import { groupSubnetsByAvailabilityZone } from "./az-grouping.js";

export interface BuildViewOptions {
  view: "overview" | "network" | "all";
  config?: DiagramConfig;
}

/**
 * Builds an explainable visual architecture model from the raw InfraGraph.
 */
export function buildViewModel(graph: InfraGraph, options: BuildViewOptions): ViewModel {
  const viewType = options.view === "all" ? "overview" : options.view;
  const isOverview = viewType === "overview";

  // 1. Enrich graph with AWS relationships
  const enrichedEdges = [...graph.edges, ...extractAwsRelationships(graph)];
  const fullGraph: InfraGraph = {
    ...graph,
    edges: enrichedEdges,
  };

  // 2. Classify subnets based on routing rules
  const subnetClassifications = classifySubnets(fullGraph);

  // 3. Compute placements (layoutParentId vs semanticScope)
  const placements = computePlacements(fullGraph);

  const viewNodes: ViewNode[] = [];
  const includedNodeIds = new Set<string>();
  const hidden = new Set(options.config?.hiddenResourceAddresses ?? []);
  const warnings: string[] = [...graph.warnings];

  // 4. Node selection and enrichment
  for (const node of fullGraph.nodes) {
    if (hidden.has(node.address)) continue;
    const rule = getAwsResourceRule(node.resourceType, node.provider);
    const placement = placements.get(node.id);
    if (node.provider !== "aws" || !AWS_RESOURCE_RULES[node.resourceType])
      warnings.push(`No architecture rule for ${node.resourceType}; preserved as a generic node.`);

    // In Overview mode, hide detail-only resources (SG rules, route table associations)
    if (isOverview && rule.visualRole === "detail-only") {
      continue;
    }

    // In Network mode, show security groups, route tables, subnets, and compute
    if (!isOverview && rule.overviewImportance === 0 && !node.resourceType.startsWith("aws_route")) {
      continue;
    }

    let subtitle: string | undefined;
    let label = node.resourceName;
    let tier: string | undefined;

    // Subtitle annotations for specific resources
    if (node.provider !== "aws") {
      subtitle = `[Generic: ${node.resourceType}]`;
    } else if (node.resourceType === "aws_subnet") {
      const cls = subnetClassifications.get(node.address);
      const cidr = typeof node.attributes["cidr_block"] === "string" ? node.attributes["cidr_block"] : "";
      const az =
        typeof node.attributes["availability_zone"] === "string" ? node.attributes["availability_zone"] : "";
      tier = cls?.overallClass ?? "unknown";
      const tierLabel = cls
        ? cls.overallClass.toUpperCase() + (cls.knowledge === "inferred" ? " (inferred)" : "")
        : "SUBNET";
      subtitle =
        `${tierLabel} | IPv4: ${cls?.ipv4Class ?? "unknown"} | IPv6: ${cls?.ipv6Class ?? "unknown"}${cls?.ipv6EgressOnly ? " (egress-only)" : ""} | ${cidr} ${az ? `(${az})` : ""}`.trim();
    } else if (node.resourceType === "aws_vpc") {
      const cidr = typeof node.attributes["cidr_block"] === "string" ? node.attributes["cidr_block"] : "";
      subtitle = `VPC ${cidr}`.trim();
    } else if (node.resourceType === "aws_instance") {
      const instType =
        typeof node.attributes["instance_type"] === "string" ? node.attributes["instance_type"] : "";
      subtitle = instType;
    } else if (node.resourceType === "aws_ecs_service") {
      const desired = node.attributes["desired_count"];
      subtitle = desired !== undefined ? `Desired Count: ${desired}` : "ECS Service";
    } else if (node.resourceType === "aws_db_instance") {
      const engine = typeof node.attributes["engine"] === "string" ? node.attributes["engine"] : "db";
      const multiAz = node.attributes["multi_az"] === true;
      subtitle = `${engine} ${multiAz ? "(Multi-AZ)" : ""}`.trim();
    } else if (node.resourceType === "aws_autoscaling_group") {
      const min = node.attributes["min_size"];
      const max = node.attributes["max_size"];
      const des = node.attributes["desired_capacity"];
      subtitle = `ASG (min:${min ?? "?"} des:${des ?? "?"} max:${max ?? "?"})`;
    } else if (!node.resourceType.startsWith("aws_")) {
      subtitle = `[Generic: ${node.resourceType}]`;
      warnings.push(
        `Resource ${node.address} belongs to unsupported provider '${node.provider}'; rendered as generic node.`,
      );
    }

    // Mark unknown state visually in label if applicable
    if (node.knowledge === "unknown") {
      label = `${label} [UNKNOWN ID]`;
    }

    const isContainer = placement?.isContainer ?? false;

    viewNodes.push({
      id: node.id,
      label,
      resourceAddress: node.address,
      resourceType: node.resourceType,
      category: rule.category,
      iconKey: rule.iconKey,
      layoutParentId: placement?.layoutParentId,
      semanticScope: placement?.semanticScope,
      isContainer,
      knowledge: node.knowledge,
      metadata: {
        ...node.attributes,
        provider: node.provider,
        evidence: node.evidence,
        change: node.change,
        unknownAttributePaths: node.unknownAttributePaths,
      },
      aggregatedAddresses: node.aggregatedAddresses,
      isAggregated: Boolean(node.aggregatedAddresses && node.aggregatedAddresses.length > 1),
      subtitle,
      tier,
    });

    includedNodeIds.add(node.id);
  }

  // Reparent children of deliberately hidden containers to the nearest visible ancestor.
  const graphNodesById = new Map(fullGraph.nodes.map((n) => [n.id, n]));
  for (const node of viewNodes) {
    const seen = new Set<string>();
    while (node.layoutParentId && !includedNodeIds.has(node.layoutParentId)) {
      if (seen.has(node.layoutParentId)) {
        node.layoutParentId = undefined;
        break;
      }
      seen.add(node.layoutParentId);
      const parent = graphNodesById.get(node.layoutParentId);
      node.layoutParentId = parent ? placements.get(parent.address)?.layoutParentId : undefined;
    }
  }

  // Network view: visual AZ containers derived from recorded subnet AZ attributes.
  if (!isOverview)
    viewNodes.splice(0, viewNodes.length, ...groupSubnetsByAvailabilityZone(viewNodes, fullGraph));

  // 5. Edge selection
  const viewEdges: ViewEdge[] = [];
  for (const edge of fullGraph.edges) {
    if (!includedNodeIds.has(edge.source) || !includedNodeIds.has(edge.target)) {
      continue;
    }

    // In Overview mode, omit container containment edges since nesting renders them visually
    if (isOverview && edge.type === "contains") {
      continue;
    }

    // IaC-only relations stay in the graph model; drawing them would read as architecture.
    if (["references", "depends_on"].includes(edge.type)) continue;
    viewEdges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      knowledge: edge.knowledge,
      evidence: edge.evidence,
      label: edge.type === "targets" ? "targets" : edge.type === "routes_to" ? "routes" : undefined,
    });
  }

  const containerCount = viewNodes.filter((n) => n.isContainer).length;

  return aggregateOverview(
    {
      viewName: viewType,
      title: isOverview ? "AWS Cloud Architecture Overview" : "Detailed Network Architecture View",
      nodes: viewNodes,
      edges: viewEdges,
      warnings: Array.from(new Set(warnings)),
      stats: {
        totalNodes: viewNodes.length,
        totalEdges: viewEdges.length,
        containerCount,
      },
    },
    fullGraph,
  );
}

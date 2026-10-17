import type { InfraGraph, InfraNode, Scope } from "@iacviz/schemas";
import { bindings, valuesAt, getAwsResourceRule } from "@iacviz/providers-aws";

export interface PlacementResult {
  nodeId: string;
  resourceAddress: string;
  layoutParentId?: string;
  semanticScope: Scope;
  isContainer: boolean;
  tier?: string;
}
/** Facts retain cloud identity; a unique visual parent is selected only with complete scope evidence. */
export function computePlacements(graph: InfraGraph): Map<string, PlacementResult> {
  const result = new Map<string, PlacementResult>();
  const subnetVpcs = new Map<string, InfraNode>();
  for (const node of graph.nodes.filter((n) => n.provider === "aws" && n.resourceType === "aws_subnet")) {
    const vpcs = bindings(graph, node, "vpc_id", ["aws_vpc"]);
    if (vpcs.length === 1) subnetVpcs.set(node.id, vpcs[0]!.node);
  }
  const cloudKey = (n: InfraNode) =>
    typeof n.attributes.id === "string" && n.attributes.id !== "[SENSITIVE]" ? n.attributes.id : n.address;
  const subnetPaths = [
    "subnet_id",
    "subnets",
    "subnet_ids",
    "vpc_zone_identifier",
    "subnet_mapping.subnet_id",
    "network_configuration.subnets",
    "vpc_config.subnet_ids",
  ];
  const unresolvedPath = (node: InfraNode, path: string) =>
    node.unresolvedReferencePaths?.some((p) => p === path || p.startsWith(path + ".")) ?? false;
  /** Subnets an unresolved collection reference (x[count.index]) may point to; never a binding. */
  const collectionCandidates = (node: InfraNode, path: string) =>
    graph.edges
      .filter(
        (e) =>
          e.source === node.id &&
          e.type === "references" &&
          e.knowledge === "unknown" &&
          e.evidence.some((ev) => ev.attributePath === path || ev.attributePath?.startsWith(path + ".")),
      )
      .flatMap((e) => graph.nodes.filter((n) => n.id === e.target && n.resourceType === "aws_subnet"));
  /**
   * complete: every subnet is known. vpcKnown: the subnet set is unknown, but every possible
   * member is an identified subnet, so their common VPC (if any) is still established.
   */
  function subnetsFor(
    node: InfraNode,
    seen = new Set<string>(),
  ): { nodes: InfraNode[]; candidates: InfraNode[]; complete: boolean; vpcKnown: boolean } {
    if (seen.has(node.id)) return { nodes: [], candidates: [], complete: false, vpcKnown: false };
    seen.add(node.id);
    const nodes = new Map<string, InfraNode>();
    const candidates = new Map<string, InfraNode>();
    let complete = true;
    let vpcKnown = true;
    for (const path of subnetPaths) {
      const raw = valuesAt(node.attributes, path).filter((v) => typeof v === "string" && v.length > 0);
      const resolved = bindings(graph, node, path, ["aws_subnet"]);
      resolved.forEach((b) => nodes.set(b.node.id, b.node));
      const possible = collectionCandidates(node, path);
      possible.forEach((n) => candidates.set(n.id, n));
      if (node.unknownAttributePaths?.some((p) => p === path || p.startsWith(path + "."))) {
        // An unknown value is settled only by configuration references that all resolved.
        const settled =
          resolved.some((b) => b.evidence.some((e) => e.source === "configuration_reference")) &&
          !unresolvedPath(node, path) &&
          !possible.length;
        if (!settled) complete = false;
        if (unresolvedPath(node, path) || (!resolved.length && !possible.length)) vpcKnown = false;
      }
      if (possible.length) complete = false;
      if (new Set(raw).size > resolved.length) complete = vpcKnown = false;
    }
    for (const b of bindings(graph, node, "db_subnet_group_name", ["aws_db_subnet_group"])) {
      const group = subnetsFor(b.node, new Set(seen));
      group.nodes.forEach((n) => nodes.set(n.id, n));
      group.candidates.forEach((n) => candidates.set(n.id, n));
      complete &&= group.complete;
      vpcKnown &&= group.vpcKnown;
    }
    return { nodes: [...nodes.values()], candidates: [...candidates.values()], complete, vpcKnown };
  }
  for (const node of graph.nodes) {
    const rule = getAwsResourceRule(node.resourceType, node.provider);
    const scope: Scope = { ...node.scope };
    let parent: InfraNode | undefined;
    if (node.provider === "aws" && node.resourceType !== "aws_vpc" && rule.placementStrategy !== "global") {
      const vpcs = bindings(graph, node, "vpc_id", ["aws_vpc"]);
      const subnets = subnetsFor(node);
      if (subnets.nodes.length) {
        scope.subnetIds = subnets.nodes.map(cloudKey).sort();
        scope.availabilityZones = [
          ...new Set(
            subnets.nodes.flatMap((n) =>
              typeof n.attributes.availability_zone === "string" ? [n.attributes.availability_zone] : [],
            ),
          ),
        ].sort();
        const parents = subnets.nodes.map((n) => subnetVpcs.get(n.id));
        const common = parents[0];
        if (subnets.complete && common && parents.every((p) => p?.id === common.id)) {
          scope.vpcId = cloudKey(common);
          if (vpcs.length === 0 || vpcs.every((v) => v.node.id === common.id)) parent = common;
        }
        if (subnets.complete && subnets.nodes.length === 1 && rule.placementStrategy === "subnet")
          parent = subnets.nodes[0];
      } else if (subnets.candidates.length && subnets.vpcKnown) {
        // Collection reference: the exact subnet is unknown, but all candidates share one VPC.
        const parents = subnets.candidates.map((n) => subnetVpcs.get(n.id));
        const common = parents[0];
        if (common && parents.every((p) => p?.id === common.id)) {
          if (vpcs.length === 0 || vpcs.every((v) => v.node.id === common.id)) parent = common;
          scope.vpcId = cloudKey(common);
        }
      } else if (vpcs.length === 1) {
        parent = vpcs[0]!.node;
        scope.vpcId = cloudKey(parent);
      }
      if (node.resourceType === "aws_subnet") {
        parent = subnetVpcs.get(node.id);
        if (parent) scope.vpcId = cloudKey(parent);
      }
    }
    const placement = {
      nodeId: node.id,
      resourceAddress: node.address,
      layoutParentId: parent?.id,
      semanticScope: scope,
      isContainer: node.provider === "aws" && rule.visualRole === "container",
    };
    result.set(node.id, placement);
    if (!node.change?.deposed) result.set(node.address, placement);
  }
  return result;
}

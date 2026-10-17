import type { InfraGraph, ViewModel, ViewNode, ViewEdge } from "@iacviz/schemas";
import { InfraGraphBuilder } from "@iacviz/core";

/** Collapse only EC2 peers with explicit ASG ownership and equivalent deployment facts. */
export function aggregateOverview(model: ViewModel, graph: InfraGraph): ViewModel {
  if (model.viewName !== "overview") return model;
  const groups = new Map<string, ViewNode[]>();
  const groupParents = new Map<string, string>();
  const groupOwners = new Map<string, string>();
  const owners = graph.nodes.filter(
    (n) => n.provider === "aws" && n.resourceType === "aws_autoscaling_group",
  );
  const facts = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const node of model.nodes) {
    const fact = facts.get(node.id);
    if (node.resourceType !== "aws_instance" || fact?.provider !== "aws" || node.knowledge !== "known")
      continue;
    const tags = fact.attributes.tags as Record<string, unknown> | undefined;
    const ownerName = tags?.["aws:autoscaling:groupName"];
    if (typeof ownerName !== "string") continue;
    const matching = owners.filter((n) => n.attributes.name === ownerName);
    if (matching.length !== 1) continue;
    // Require complete common subnet and instance type, not name similarity.
    if (!fact.scope?.subnetIds?.length || !fact.attributes.instance_type || !node.layoutParentId) continue;
    const owner = model.nodes.find((n) => n.id === matching[0]!.id);
    const ownerSubnets = owner?.semanticScope?.subnetIds;
    const verifiedSpan =
      !!owner?.layoutParentId &&
      !!ownerSubnets?.length &&
      ownerSubnets.length > 1 &&
      fact.scope.subnetIds.every((id) => ownerSubnets.includes(id)) &&
      graph.nodes.some((n) => n.id === owner.layoutParentId && n.resourceType === "aws_vpc");
    const security = fact.attributes.vpc_security_group_ids;
    const key = JSON.stringify([
      matching[0]!.id,
      fact.moduleAddress,
      verifiedSpan ? owner!.layoutParentId : node.layoutParentId,
      fact.attributes.instance_type,
      verifiedSpan ? "verified-ASG-subnets" : [...fact.scope.subnetIds].sort(),
      Array.isArray(security) ? [...security].sort() : null,
    ]);
    if (verifiedSpan) groupParents.set(key, owner!.layoutParentId!);
    groupOwners.set(key, matching[0]!.address);
    const group = groups.get(key) ?? [];
    group.push(node);
    groups.set(key, group);
  }
  const remap = new Map<string, string>();
  const replacements: ViewNode[] = [];
  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    members.sort((a, b) => a.resourceAddress.localeCompare(b.resourceAddress));
    const id = InfraGraphBuilder.makeNodeId("aggregate:" + key);
    const addresses = members.map((n) => n.resourceAddress);
    const subnetIds = [...new Set(members.flatMap((n) => n.semanticScope?.subnetIds ?? []))].sort();
    const availabilityZones = [
      ...new Set(members.flatMap((n) => n.semanticScope?.availabilityZones ?? [])),
    ].sort();
    const multiAz = availabilityZones.length > 1;
    for (const member of members) remap.set(member.id, id);
    replacements.push({
      ...members[0]!,
      id,
      label: `EC2 × ${members.length}`,
      subtitle: `ASG members | ${facts.get(members[0]!.id)!.attributes.instance_type}${multiAz ? " | Multi-AZ" : ""}`,
      layoutParentId: groupParents.get(key) ?? members[0]!.layoutParentId,
      semanticScope: { ...members[0]!.semanticScope, subnetIds, availabilityZones },
      aggregatedAddresses: addresses,
      isAggregated: true,
      metadata: {
        provider: "aws",
        instance_type: facts.get(members[0]!.id)!.attributes.instance_type,
        ownerAddress: groupOwners.get(key),
        aggregationRule: groupParents.has(key)
          ? "aws.explicit-asg.verified-multi-subnet"
          : "aws.explicit-asg.same-subnet",
        memberResourceIds: members.map((n) => facts.get(n.id)!.attributes.id),
        memberAddresses: addresses,
      },
    });
  }
  const nodes = [...model.nodes.filter((n) => !remap.has(n.id)), ...replacements];
  const edges = new Map<string, ViewEdge>();
  for (const edge of model.edges) {
    const source = remap.get(edge.source) ?? edge.source,
      target = remap.get(edge.target) ?? edge.target;
    if (source === target) continue;
    const id = InfraGraphBuilder.makeEdgeId(source, target, edge.type);
    const old = edges.get(id);
    if (old) {
      old.evidence.push(...edge.evidence);
      if (edge.knowledge !== "known") old.knowledge = edge.knowledge;
    } else edges.set(id, { ...edge, id, source, target, evidence: [...edge.evidence] });
  }
  return {
    ...model,
    nodes,
    edges: [...edges.values()],
    stats: { ...model.stats, totalNodes: nodes.length, totalEdges: edges.size },
  };
}

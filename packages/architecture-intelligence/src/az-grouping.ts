import { createHash } from "node:crypto";
import { AZ_GROUP_TYPE, type InfraGraph, type ViewNode } from "@iacviz/schemas";

/**
 * Network view: groups subnets inside each visible VPC by their recorded `availability_zone`.
 *
 * AZ groups are purely visual containers. They are created only from a known, string-valued
 * subnet attribute; subnets with an unknown AZ stay directly in the VPC. No Terraform resource
 * is invented and no relationship is added.
 */
export function groupSubnetsByAvailabilityZone(nodes: ViewNode[], graph: InfraGraph): ViewNode[] {
  const graphById = new Map(graph.nodes.map((n) => [n.id, n]));
  const visible = new Set(nodes.map((n) => n.id));
  const groups = new Map<string, ViewNode>();

  for (const node of nodes) {
    if (node.resourceType !== "aws_subnet" || !node.layoutParentId || !visible.has(node.layoutParentId))
      continue;
    const az = graphById.get(node.id)?.attributes["availability_zone"];
    if (typeof az !== "string" || az.length === 0) continue;

    const vpcId = node.layoutParentId;
    const key = `${vpcId}\u0000${az}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        id: "az_" + createHash("sha256").update(key).digest("hex").slice(0, 32),
        label: az,
        subtitle: "Availability Zone (from subnet attributes)",
        resourceAddress: "",
        resourceType: AZ_GROUP_TYPE,
        category: "network",
        layoutParentId: vpcId,
        isContainer: true,
        knowledge: "known",
        metadata: {
          synthetic: true,
          basis:
            "Visual grouping by the availability_zone attribute of member subnets; not a Terraform resource.",
          memberSubnetAddresses: [] as string[],
        },
        isAggregated: false,
      };
      groups.set(key, group);
    }
    (group.metadata["memberSubnetAddresses"] as string[]).push(node.resourceAddress);
    node.layoutParentId = group.id;
  }

  const ordered = [...groups.values()].sort(
    (a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id),
  );
  for (const group of ordered) (group.metadata["memberSubnetAddresses"] as string[]).sort();
  return [...nodes, ...ordered];
}

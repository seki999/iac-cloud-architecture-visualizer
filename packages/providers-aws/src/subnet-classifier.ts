import type { InfraGraph, InfraNode } from "@iacviz/schemas";
import { bindings, valuesAt } from "./bindings.js";
export type SubnetClass =
  "public" | "private-nat-egress" | "private-hybrid" | "private-no-default-egress" | "unknown";
export interface SubnetClassificationResult {
  subnetAddress: string;
  ipv4Class: SubnetClass;
  ipv6Class: SubnetClass;
  overallClass: SubnetClass;
  associatedRouteTableAddress?: string;
  evidence: string[];
  ipv6EgressOnly?: boolean;
  /** "inferred" when the route table was deduced from a count/for_each association block. */
  knowledge: "known" | "inferred";
}

/** Unresolved collection references recorded by the plan parser for one attribute. */
function collectionTargets(graph: InfraGraph, source: InfraNode, path: string): string[] {
  return graph.edges
    .filter(
      (e) =>
        e.source === source.id &&
        e.type === "references" &&
        e.knowledge === "unknown" &&
        e.evidence.some((ev) => ev.source === "configuration_reference" && ev.attributePath === path),
    )
    .map((e) => e.target)
    .sort();
}

/**
 * Plans often bind associations as `subnet_id = aws_subnet.x[count.index].id`; Terraform JSON only
 * records the collection, so the instance mapping is unknown. The route table can still be deduced
 * when every association referencing exactly this subnet collection uses one route table and there
 * are as many associations as subnets: AWS permits one explicit association per subnet, so an
 * applicable plan associates each member with that table. Anything less returns undefined.
 */
function collectionRouteTable(graph: InfraGraph, aws: InfraNode[], subnet: InfraNode): InfraNode | undefined {
  const candidates = aws.filter(
    (n) =>
      n.resourceType === "aws_route_table_association" &&
      bindings(graph, n, "subnet_id", ["aws_subnet"]).length === 0 &&
      collectionTargets(graph, n, "subnet_id").includes(subnet.id),
  );
  if (!candidates.length) return undefined;
  const members = collectionTargets(graph, candidates[0]!, "subnet_id");
  const memberNodes = members.map((id) => graph.nodes.find((n) => n.id === id));
  if (memberNodes.some((n) => n?.resourceType !== "aws_subnet")) return undefined;
  if (candidates.some((c) => collectionTargets(graph, c, "subnet_id").join("|") !== members.join("|")))
    return undefined;
  if (candidates.length !== members.length) return undefined;
  const tables = candidates.map((c) => bindings(graph, c, "route_table_id", ["aws_route_table"]));
  if (tables.some((t) => t.length !== 1)) return undefined;
  const ids = new Set(tables.map((t) => t[0]!.node.id));
  return ids.size === 1 ? tables[0]![0]!.node : undefined;
}
/** Classify effective routing using typed association evidence, never resource names. */
export function classifySubnets(graph: InfraGraph): Map<string, SubnetClassificationResult> {
  const result = new Map<string, SubnetClassificationResult>();
  const aws = graph.nodes.filter((n) => n.provider === "aws" && !n.change?.deposed);
  for (const subnet of aws.filter((n) => n.resourceType === "aws_subnet")) {
    const evidence: string[] = [];
    const unknown = (reason: string) =>
      result.set(subnet.address, {
        subnetAddress: subnet.address,
        ipv4Class: "unknown",
        ipv6Class: "unknown",
        overallClass: "unknown",
        evidence: [reason],
        knowledge: "known",
      });
    const explicit = aws.filter(
      (n) =>
        n.resourceType === "aws_route_table_association" &&
        bindings(graph, n, "subnet_id", ["aws_subnet"]).some((b) => b.node.id === subnet.id),
    );
    let tables: InfraNode[] = [];
    let knowledge: "known" | "inferred" = "known";
    const deduced = explicit.length ? undefined : collectionRouteTable(graph, aws, subnet);
    if (deduced) {
      tables = [deduced];
      knowledge = "inferred";
      evidence.push(
        `Route table ${deduced.address} deduced from a count/for_each association block over the subnet collection (one association per subnet).`,
      );
    } else if (explicit.length) {
      tables = explicit.flatMap((n) =>
        bindings(graph, n, "route_table_id", ["aws_route_table"]).map((b) => b.node),
      );
      if (tables.length !== explicit.length) {
        unknown("Explicit route-table association is unresolved.");
        continue;
      }
    } else {
      const vpcs = bindings(graph, subnet, "vpc_id", ["aws_vpc"]);
      if (vpcs.length === 1)
        tables = aws
          .filter(
            (n) =>
              n.resourceType === "aws_main_route_table_association" &&
              bindings(graph, n, "vpc_id", ["aws_vpc"]).some((b) => b.node.id === vpcs[0]!.node.id),
          )
          .flatMap((n) => bindings(graph, n, "route_table_id", ["aws_route_table"]).map((b) => b.node));
    }
    tables = [...new Map(tables.map((n) => [n.id, n])).values()];
    if (tables.length !== 1) {
      unknown("A unique effective route table cannot be established from the input.");
      continue;
    }
    const table = tables[0]!;
    const inline = valuesAt(table.attributes, "route").filter(
      (v): v is Record<string, unknown> => !!v && typeof v === "object",
    );
    const standalone = aws.filter(
      (n) =>
        n.resourceType === "aws_route" &&
        bindings(graph, n, "route_table_id", ["aws_route_table"]).some((b) => b.node.id === table.id),
    );
    const routes = [
      ...inline.map((r) => ({
        attributes: r,
        node: table,
        prefix: "route.",
        canUseReferences: inline.length === 1,
      })),
      ...standalone.map((node) => ({
        attributes: node.attributes,
        node,
        prefix: "",
        canUseReferences: true,
      })),
    ];
    const complete =
      Array.isArray(table.attributes.route) &&
      !table.unknownAttributePaths?.some(
        (p) => p === "route" || /route\.\d+\.(cidr_block|ipv6_cidr_block)$/.test(p),
      );
    let egressOnly = false;
    function classify(family: 4 | 6): SubnetClass {
      const classes: SubnetClass[] = [];
      for (const route of routes) {
        const a = route.attributes;
        const destination =
          family === 4
            ? (a.destination_cidr_block ?? a.cidr_block)
            : (a.destination_ipv6_cidr_block ?? a.ipv6_cidr_block);
        if (destination !== (family === 4 ? "0.0.0.0/0" : "::/0")) continue;
        const target = (key: string, type: string, prefix: string) => {
          const value = a[key];
          if (
            typeof value === "string" &&
            value !== "[SENSITIVE]" &&
            value.startsWith(prefix) &&
            value.length > prefix.length
          )
            return true;
          return (
            route.canUseReferences && bindings(graph, route.node, route.prefix + key, [type]).length === 1
          );
        };
        let cls: SubnetClass = "unknown";
        if (target("gateway_id", "aws_internet_gateway", "igw-")) cls = "public";
        else if (target("nat_gateway_id", "aws_nat_gateway", "nat-")) cls = "private-nat-egress";
        else if (
          family === 6 &&
          target("egress_only_gateway_id", "aws_egress_only_internet_gateway", "eigw-")
        ) {
          cls = "private-hybrid";
          egressOnly = true;
        } else if (
          (typeof a.transit_gateway_id === "string" && a.transit_gateway_id.startsWith("tgw-")) ||
          (typeof a.vpc_peering_connection_id === "string" &&
            a.vpc_peering_connection_id.startsWith("pcx-")) ||
          (typeof a.gateway_id === "string" && a.gateway_id.startsWith("vgw-"))
        )
          cls = "private-hybrid";
        classes.push(cls);
        evidence.push(`IPv${family} default route: ${cls}; evidence resource ${route.node.address}.`);
      }
      const unique = [...new Set(classes)];
      if (unique.length === 1) return unique[0]!;
      if (unique.length > 1) return "unknown";
      return complete ? "private-no-default-egress" : "unknown";
    }
    const ipv4Class = classify(4),
      ipv6Class = classify(6);
    // A subnet recorded with no IPv6 CIDR has no IPv6 routing to consider.
    const noIpv6 =
      subnet.attributes["ipv6_cidr_block"] === null &&
      !subnet.unknownAttributePaths?.includes("ipv6_cidr_block") &&
      subnet.attributes["ipv6_native"] !== true;
    if (noIpv6) evidence.push("Subnet has no IPv6 CIDR; overall class follows IPv4.");
    const overallClass: SubnetClass = noIpv6
      ? ipv4Class
      : ipv4Class === "public" || ipv6Class === "public"
        ? "public"
        : ipv4Class === "unknown" || ipv6Class === "unknown"
          ? "unknown"
          : ipv4Class === "private-nat-egress" || ipv6Class === "private-nat-egress"
            ? "private-nat-egress"
            : ipv4Class === "private-hybrid" || ipv6Class === "private-hybrid"
              ? "private-hybrid"
              : "private-no-default-egress";
    result.set(subnet.address, {
      subnetAddress: subnet.address,
      ipv4Class,
      ipv6Class,
      overallClass,
      associatedRouteTableAddress: table.address,
      evidence,
      ipv6EgressOnly: egressOnly,
      knowledge,
    });
  }
  return result;
}

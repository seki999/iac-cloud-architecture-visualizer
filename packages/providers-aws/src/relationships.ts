import type { InfraGraph, InfraEdge, InfraNode, Evidence, KnowledgeState } from "@iacviz/schemas";
import { InfraGraphBuilder } from "@iacviz/core";
import { bindings, valuesAt } from "./bindings.js";

/** Typed, evidence-backed AWS relations. No names, tags or dependency edges imply traffic. */
export function extractAwsRelationships(graph: InfraGraph): InfraEdge[] {
  const result = new Map<string, InfraEdge>();
  const existing = new Set(graph.edges.map((e) => e.id));
  function add(
    source: InfraNode,
    target: InfraNode,
    type: InfraEdge["type"],
    evidence: Evidence[],
    knowledge: KnowledgeState = "known",
  ) {
    if (source.id === target.id) return;
    const id = InfraGraphBuilder.makeEdgeId(source.id, target.id, type);
    if (existing.has(id)) return;
    const old = result.get(id);
    if (old) {
      old.evidence.push(...evidence);
      if (old.knowledge !== "known" && knowledge === "known") old.knowledge = "known";
      return;
    }
    result.set(id, { id, source: source.id, target: target.id, type, evidence: [...evidence], knowledge });
  }
  const fields: Record<string, { types: string[]; type: InfraEdge["type"] }> = {
    vpc_id: { types: ["aws_vpc"], type: "associated_with" },
    subnet_id: { types: ["aws_subnet"], type: "associated_with" },
    subnet_ids: { types: ["aws_subnet"], type: "associated_with" },
    subnets: { types: ["aws_subnet"], type: "associated_with" },
    vpc_zone_identifier: { types: ["aws_subnet"], type: "associated_with" },
    "subnet_mapping.subnet_id": { types: ["aws_subnet"], type: "associated_with" },
    "network_configuration.subnets": { types: ["aws_subnet"], type: "associated_with" },
    "vpc_config.subnet_ids": { types: ["aws_subnet"], type: "associated_with" },
    security_groups: { types: ["aws_security_group"], type: "associated_with" },
    vpc_security_group_ids: { types: ["aws_security_group"], type: "associated_with" },
    "network_configuration.security_groups": { types: ["aws_security_group"], type: "associated_with" },
    "vpc_config.security_group_ids": { types: ["aws_security_group"], type: "associated_with" },
    security_group_id: { types: ["aws_security_group"], type: "associated_with" },
    referenced_security_group_id: { types: ["aws_security_group"], type: "references" },
    route_table_id: { types: ["aws_route_table"], type: "associated_with" },
    route_table_ids: { types: ["aws_route_table"], type: "associated_with" },
    gateway_id: { types: ["aws_internet_gateway"], type: "routes_to" },
    nat_gateway_id: { types: ["aws_nat_gateway"], type: "routes_to" },
    egress_only_gateway_id: { types: ["aws_egress_only_internet_gateway"], type: "routes_to" },
    "route.gateway_id": { types: ["aws_internet_gateway"], type: "routes_to" },
    "route.nat_gateway_id": { types: ["aws_nat_gateway"], type: "routes_to" },
    "route.egress_only_gateway_id": { types: ["aws_egress_only_internet_gateway"], type: "routes_to" },
    cluster: { types: ["aws_ecs_cluster"], type: "associated_with" },
    task_definition: { types: ["aws_ecs_task_definition"], type: "references" },
    db_subnet_group_name: { types: ["aws_db_subnet_group"], type: "associated_with" },
    cluster_name: { types: ["aws_eks_cluster"], type: "associated_with" },
    network_acl_id: { types: ["aws_network_acl"], type: "associated_with" },
    "launch_template.id": { types: ["aws_launch_template"], type: "references" },
  };
  const aws = graph.nodes.filter((n) => n.provider === "aws" && !n.change?.deposed);
  for (const node of aws) {
    for (const [path, rule] of Object.entries(fields))
      for (const binding of bindings(graph, node, path, rule.types)) {
        if (path === "vpc_id" && node.resourceType === "aws_subnet")
          add(binding.node, node, "contains", binding.evidence, binding.knowledge);
        if (path === "subnet_id" && node.resourceType === "aws_instance")
          add(binding.node, node, "contains", binding.evidence, binding.knowledge);
        if (
          path === "vpc_id" &&
          ["aws_internet_gateway", "aws_egress_only_internet_gateway"].includes(node.resourceType)
        )
          add(node, binding.node, "attached_to", binding.evidence, binding.knowledge);
        add(node, binding.node, rule.type, binding.evidence, binding.knowledge);
      }
    if (node.resourceType === "aws_ecs_service")
      for (const b of bindings(graph, node, "load_balancer.target_group_arn", ["aws_lb_target_group"]))
        add(b.node, node, "targets", b.evidence, b.knowledge);
    if (node.resourceType === "aws_lb_target_group_attachment") {
      const groups = bindings(graph, node, "target_group_arn", ["aws_lb_target_group"]);
      const targets = bindings(graph, node, "target_id", ["aws_instance", "aws_lambda_function"]);
      for (const group of groups)
        for (const target of targets)
          add(
            group.node,
            target.node,
            "targets",
            [...group.evidence, ...target.evidence],
            group.knowledge === "known" && target.knowledge === "known" ? "known" : "inferred",
          );
    }
    if (node.resourceType === "aws_lb")
      for (const b of bindings(graph, node, "access_logs.bucket", ["aws_s3_bucket"])) {
        if (valuesAt(node.attributes, "access_logs.enabled").includes(false)) continue;
        add(node, b.node, "references", b.evidence, b.knowledge);
      }
  }
  // Listener and listener-rule forwarding, including weighted target groups.
  for (const node of aws.filter((n) =>
    ["aws_lb_listener", "aws_lb_listener_rule"].includes(n.resourceType),
  )) {
    const rule = node.resourceType === "aws_lb_listener_rule";
    const listeners = rule
      ? bindings(graph, node, "listener_arn", ["aws_lb_listener"])
      : [{ node, knowledge: "known" as const, evidence: [] as Evidence[] }];
    const actionPath = rule ? "action" : "default_action";
    const actions = valuesAt(node.attributes, actionPath).filter(
      (a): a is Record<string, unknown> => !!a && typeof a === "object",
    );
    const forwards = actions.filter((a) => a.type === "forward");
    if (!forwards.length) continue;
    const targetRefs = forwards.flatMap((a) => [
      ...valuesAt(a, "target_group_arn"),
      ...valuesAt(a, "forward.target_group")
        .filter((t) => !!t && typeof t === "object" && (t as Record<string, unknown>).weight !== 0)
        .flatMap((t) => valuesAt(t, "arn")),
    ]);
    for (const listener of listeners)
      for (const lb of bindings(graph, listener.node, "load_balancer_arn", ["aws_lb"])) {
        for (const path of [actionPath + ".target_group_arn", actionPath + ".forward.target_group.arn"]) {
          for (const tg of bindings(graph, node, path, ["aws_lb_target_group"])) {
            if (
              tg.knowledge === "known" &&
              ![tg.node.attributes.id, tg.node.attributes.arn, tg.node.attributes.name].some((id) =>
                targetRefs.includes(id),
              )
            )
              continue;
            if (
              tg.knowledge !== "known" &&
              path.endsWith(".arn") &&
              forwards.some((a) =>
                valuesAt(a, "forward.target_group").some(
                  (t) =>
                    !!t &&
                    typeof t === "object" &&
                    (t as Record<string, unknown>).weight === 0 &&
                    !(t as Record<string, unknown>).arn,
                ),
              )
            )
              continue;
            add(
              lb.node,
              tg.node,
              "targets",
              [
                ...listener.evidence,
                ...lb.evidence,
                ...tg.evidence,
                {
                  source: "provider_rule",
                  resourceAddress: node.address,
                  attributePath: actionPath,
                  ruleId: "aws.listener.forward",
                  description:
                    "Configured forward action; zero-weight groups excluded. Actual request delivery is not asserted.",
                },
              ],
              listener.knowledge === "known" && lb.knowledge === "known" && tg.knowledge === "known"
                ? "known"
                : "inferred",
            );
          }
        }
      }
  }
  return [...result.values()];
}

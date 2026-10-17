import { configurationResolver } from "./configuration-resolver.js";
import type { InfraGraph, EngineKind, TerraformModuleConfig, TerraformModuleValue } from "@iacviz/schemas";
import { TerraformPlanFileSchema } from "@iacviz/schemas";
import {
  InfraGraphBuilder,
  parseResourceAddress,
  sanitizeAttributes,
  omitUnknownAttributes,
  unknownAttributePaths,
} from "@iacviz/core";
import { normalizeProviderName } from "./state-parser.js";

/** Parse planned instances first; resolve configuration references only against actual nodes. */
export function parseTerraformPlan(rawJson: unknown, engine: EngineKind = "unknown"): InfraGraph {
  const result = TerraformPlanFileSchema.safeParse(rawJson);
  if (!result.success)
    throw new Error("Invalid plan structure; expected Terraform show -json representation.");
  const plan = result.data;
  const builder = new InfraGraphBuilder({
    engine,
    kind: "plan",
    terraformVersion: plan.terraform_version,
    formatVersion: plan.format_version,
  });
  if (plan.errored)
    builder.addWarning("Input plan reports a planning error; architecture may be incomplete.");
  if (plan.complete === false)
    builder.addWarning("Input plan is incomplete; unknown infrastructure remains.");
  for (const key of ["resource_drift", "output_changes", "checks", "proposed_unknown"] as const) {
    if (plan[key]) builder.addWarning(`Plan contains ${key}; only resource architecture is rendered.`);
  }
  function values(mod?: TerraformModuleValue) {
    for (const res of mod?.resources ?? []) {
      const attrs = sanitizeAttributes(res.values, res.sensitive_values);
      builder.addNode({
        address: res.address,
        provider: normalizeProviderName(res.provider_name),
        resourceType: res.type,
        resourceName: res.name,
        mode: res.mode,
        moduleAddress: mod?.address,
        attributes: attrs,
        knowledge: typeof attrs.id === "string" ? "known" : "unknown",
        evidence: [
          {
            source: "plan_value",
            resourceAddress: res.address,
            description: "Resource present in planned_values",
          },
        ],
      });
    }
    for (const child of mod?.child_modules ?? []) values(child);
  }
  // Changes carry the authoritative sensitivity masks; process them before planned_values.
  for (const rc of plan.resource_changes ?? []) {
    const deleting = rc.change.after === null;
    const sanitized = sanitizeAttributes(
      deleting ? rc.change.before : rc.change.after,
      deleting ? rc.change.before_sensitive : rc.change.after_sensitive,
    );
    const paths = deleting ? [] : unknownAttributePaths(rc.change.after_unknown);
    const attrs = deleting ? sanitized : omitUnknownAttributes(sanitized, rc.change.after_unknown);
    // Deposed objects have separate identity but retain the canonical Terraform address.
    const node = builder.addNode({
      address: rc.address,
      unknownAttributePaths: paths.length ? paths : undefined,
      identitySuffix: rc.deposed ? "#deposed:" + rc.deposed : undefined,
      provider: normalizeProviderName(rc.provider_name ?? "unknown"),
      resourceType: rc.type,
      resourceName: rc.name,
      mode: rc.mode,
      moduleAddress: rc.module_address,
      attributes: attrs,
      knowledge: rc.change.after_unknown?.id === true || !attrs.id ? "unknown" : "known",
      change: {
        actions: rc.change.actions as NonNullable<InfraGraph["nodes"][number]["change"]>["actions"],
        actionReason: rc.action_reason,
        replacePaths: rc.change.replace_paths,
        previousAddress: rc.previous_address,
        deposed: rc.deposed,
      },
      evidence: [
        {
          source: "plan_value",
          resourceAddress: rc.address,
          description: `Planned actions: ${rc.change.actions.join(", ")}`,
        },
      ],
    });
    if (rc.deposed)
      builder.addWarning(
        `Deposed object recorded for ${node.address}; separate historical rendering is not implemented.`,
      );
  }
  values(plan.planned_values?.root_module);
  const nodes = builder.getAllNodes();
  let ambiguousTargets: typeof nodes = [];
  const resolver = configurationResolver(
    plan.configuration?.root_module ?? {},
    nodes,
    (message) => builder.addWarning(message),
    (targets) => {
      ambiguousTargets.push(...targets);
    },
  );
  const stripIndexes = (address: string) => {
    // Parse module and resource keys without stripping dots inside quoted keys.
    const parsed = parseResourceAddress(address);
    return `${parsed.moduleAddress?.replace(/\[(?:"(?:[^"\\]|\\.)*"|\d+)\]/g, "") ?? ""}|${parsed.mode}|${parsed.resourceType}|${parsed.resourceName}`;
  };
  function config(mod: TerraformModuleConfig, prefix = "") {
    for (const res of mod.resources ?? []) {
      const fullAddress =
        prefix && !res.address.startsWith("module.") ? `${prefix}.${res.address}` : res.address;
      const sources = nodes.filter(
        (n) => !n.change?.deposed && stripIndexes(n.address) === stripIndexes(fullAddress),
      );
      for (const source of sources) {
        const sourceModule = parseResourceAddress(source.address).moduleAddress;
        const resolve = (ref: string, dependency = false) => {
          ambiguousTargets = [];
          return resolver(ref, sourceModule ?? "", dependency);
        };
        for (const dep of res.depends_on ?? [])
          for (const target of resolve(dep, true))
            builder.addEdge(source.address, target.address, "depends_on", [
              {
                source: "configuration_reference",
                resourceAddress: source.address,
                description: "Explicit IaC dependency; does not imply traffic or binding.",
              },
            ]);
        const unresolved = (path: string) => {
          const paths = new Set(source.unresolvedReferencePaths ?? []).add(path);
          source.unresolvedReferencePaths = [...paths].sort();
        };
        function expressions(value: unknown, path: string) {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) {
            value.forEach((v) => expressions(v, path));
            return;
          }
          const obj = value as Record<string, unknown>;
          const refs = Array.isArray(obj.references)
            ? obj.references.filter((r): r is string => typeof r === "string")
            : [];
          for (const ref of refs) {
            // Terraform also lists each containing object (x.y[0].id, x.y[0], x.y); keep the most specific.
            if (refs.some((other) => other.startsWith(ref + ".") || other.startsWith(ref + "["))) continue;
            // Instance keys and metadata carry no resource identity.
            if (/^(count\.index$|each\.key$|path\.|terraform\.)/.test(ref)) continue;
            if (/^(local|each)\./.test(ref)) {
              unresolved(path);
              continue;
            }
            const targets = resolve(ref);
            if (!targets.length && !ambiguousTargets.length) unresolved(path);
            for (const target of ambiguousTargets) {
              if (target.id !== source.id)
                builder.addEdge(
                  source.address,
                  target.address,
                  "references",
                  [
                    {
                      source: "configuration_reference",
                      resourceAddress: source.address,
                      attributePath: path,
                      description:
                        "Resource collection reference; instance mapping is unresolved. This is not a binding.",
                    },
                  ],
                  "unknown",
                );
            }
            for (const target of targets) {
              if (source.id === target.id) continue;
              const binding =
                /(^|\.)(subnet_id|subnets|subnet_ids|vpc_id|security_groups|vpc_security_group_ids|vpc_zone_identifier|db_subnet_group_name)$/.test(
                  path,
                );
              builder.addEdge(
                source.address,
                target.address,
                binding ? "associated_with" : "references",
                [
                  {
                    source: "configuration_reference",
                    resourceAddress: source.address,
                    attributePath: path,
                    description:
                      "Configuration expression references a resource; not proof of business traffic.",
                  },
                ],
                "inferred",
              );
            }
          }
          for (const [key, v] of Object.entries(obj))
            if (key !== "references" && key !== "constant_value")
              expressions(v, path ? `${path}.${key}` : key);
        }
        expressions(res.expressions, "");
      }
    }
    for (const [name, call] of Object.entries(mod.module_calls ?? {}))
      if (call.module) config(call.module, prefix ? `${prefix}.module.${name}` : `module.${name}`);
  }
  if (plan.configuration?.root_module) config(plan.configuration.root_module);
  return builder.build();
}

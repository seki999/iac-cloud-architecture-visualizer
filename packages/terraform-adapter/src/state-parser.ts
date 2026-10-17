import type { InfraGraph, EngineKind } from "@iacviz/schemas";
import { TerraformStateFileSchema } from "@iacviz/schemas";
import { InfraGraphBuilder } from "@iacviz/core";

export function normalizeProviderName(provider: string): string {
  if (provider.includes("/")) {
    const parts = provider.split("/");
    return parts[parts.length - 1] ?? provider;
  }
  return provider;
}

export function parseTerraformState(rawJson: unknown, engine: EngineKind = "unknown"): InfraGraph {
  const result = TerraformStateFileSchema.safeParse(rawJson);
  if (!result.success)
    throw new Error("Invalid state structure; expected Terraform show -json representation.");
  const state = result.data;

  const builder = new InfraGraphBuilder({
    engine,
    kind: "state",
    terraformVersion: state.terraform_version,
    formatVersion: state.format_version,
  });

  const rootModule = state.values.root_module;
  if (!rootModule) {
    return builder.build();
  }

  function processModule(mod: {
    address?: string;
    resources?: Array<{
      address: string;
      mode?: "managed" | "data";
      type: string;
      name: string;
      index?: string | number;
      provider_name: string;
      values?: Record<string, unknown>;
      sensitive_values?: Record<string, unknown>;
    }>;
    child_modules?: unknown[];
  }) {
    if (mod.resources) {
      for (const res of mod.resources) {
        const rawVals = res.values ?? {};
        const sensVals = res.sensitive_values ?? {};

        // Scope extraction if present
        const vpcId = typeof rawVals["vpc_id"] === "string" ? rawVals["vpc_id"] : undefined;
        const subnetId = typeof rawVals["subnet_id"] === "string" ? rawVals["subnet_id"] : undefined;
        const rawSubnetIds = Array.isArray(rawVals["subnet_ids"])
          ? (rawVals["subnet_ids"] as string[])
          : Array.isArray(rawVals["subnets"])
            ? (rawVals["subnets"] as string[])
            : undefined;

        const subnetIds = subnetId ? [subnetId] : rawSubnetIds;
        const az =
          typeof rawVals["availability_zone"] === "string" ? rawVals["availability_zone"] : undefined;

        builder.addNode({
          address: res.address,
          provider: normalizeProviderName(res.provider_name),
          resourceType: res.type,
          resourceName: res.name,
          mode: res.mode ?? "managed",
          moduleAddress: mod.address,
          attributes: rawVals,
          sensitiveMap: sensVals,
          knowledge: "known",
          scope: {
            vpcId,
            subnetIds,
            availabilityZones: az ? [az] : undefined,
          },
          evidence: [
            {
              source: "state_value",
              resourceAddress: res.address,
              description: `Loaded from state values (${res.address})`,
            },
          ],
        });
      }
    }

    if (mod.child_modules && Array.isArray(mod.child_modules)) {
      for (const child of mod.child_modules) {
        processModule(child as Parameters<typeof processModule>[0]);
      }
    }
  }

  processModule(rootModule);
  return builder.build();
}

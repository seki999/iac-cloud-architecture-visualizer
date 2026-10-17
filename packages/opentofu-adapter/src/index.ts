import type { InfraGraph } from "@iacviz/schemas";
import {
  parseTerraformJson,
  detectInputType,
  parseTerraformState,
  parseTerraformPlan,
} from "@iacviz/terraform-adapter";

export { detectInputType };

/**
 * Universal OpenTofu JSON entrypoint:
 * Parses 'tofu show -json' state or plan output and marks engine as 'opentofu'.
 */
export function parseOpenTofuJson(jsonString: string): InfraGraph {
  return parseTerraformJson(jsonString, "opentofu");
}

export function parseOpenTofuState(rawJson: unknown): InfraGraph {
  return parseTerraformState(rawJson, "opentofu");
}

export function parseOpenTofuPlan(rawJson: unknown): InfraGraph {
  return parseTerraformPlan(rawJson, "opentofu");
}

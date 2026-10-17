import type { InfraGraph, EngineKind } from "@iacviz/schemas";
import { detectInputType } from "./detector.js";
import { parseTerraformState } from "./state-parser.js";
import { parseTerraformPlan } from "./plan-parser.js";

export * from "./detector.js";
export * from "./state-parser.js";
export * from "./plan-parser.js";

/**
 * Universal Terraform JSON entrypoint:
 * Detects whether the input string is a State or Plan representation and parses it.
 */
export function parseTerraformJson(jsonString: string, engine: EngineKind = "unknown"): InfraGraph {
  const detected = detectInputType(jsonString);
  if (detected.kind === "state") {
    return parseTerraformState(detected.rawJson, engine);
  } else {
    return parseTerraformPlan(detected.rawJson, engine);
  }
}

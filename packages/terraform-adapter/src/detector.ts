import { isSupportedFormatVersion } from "@iacviz/schemas";

export type DetectedInputKind = "state" | "plan";

export interface InputDetectionResult {
  kind: DetectedInputKind;
  formatVersion: string;
  terraformVersion?: string;
  rawJson: Record<string, unknown>;
}

/**
 * Validates JSON structure, verifies format_version compatibility,
 * and determines whether the input is a Terraform/OpenTofu State or Plan.
 */
export function detectInputType(jsonString: string): InputDetectionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("Invalid JSON input: Failed to parse string as JSON.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid IaC JSON: Top-level structure must be a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;

  // Check format_version
  const formatVersion = obj["format_version"];
  if (typeof formatVersion !== "string" || !formatVersion) {
    throw new Error(
      "Unsupported IaC format: Missing 'format_version'. This tool expects machine-readable JSON output from 'terraform show -json' or 'tofu show -json', not raw .tfstate files.",
    );
  }

  if (!isSupportedFormatVersion(formatVersion)) {
    throw new Error("Unsupported format_version. Only numeric format_version 1.x is supported.");
  }

  const tfVersion = typeof obj["terraform_version"] === "string" ? obj["terraform_version"] : undefined;

  // Plan representation has planned_values, resource_changes, or configuration
  if ("resource_changes" in obj || "planned_values" in obj || "configuration" in obj) {
    return {
      kind: "plan",
      formatVersion,
      terraformVersion: tfVersion,
      rawJson: obj,
    };
  }

  // State representation has values.root_module
  if ("values" in obj && typeof obj["values"] === "object" && obj["values"] !== null) {
    return {
      kind: "state",
      formatVersion,
      terraformVersion: tfVersion,
      rawJson: obj,
    };
  }

  throw new Error(
    "Unrecognized IaC JSON: Object contains 'format_version' but neither plan elements ('resource_changes', 'planned_values') nor state elements ('values.root_module') were found.",
  );
}

import { z } from "zod";

/**
 * Validates format_version compatibility:
 * - Major version 1 is supported (e.g., "1.0", "1.1", "1.2").
 * - Major versions >= 2 must be rejected.
 */
export function isSupportedFormatVersion(version: string): boolean {
  return /^1\.\d+$/.test(version);
}

export const TerraformResourceValueSchema = z.object({
  address: z.string(),
  mode: z.enum(["managed", "data"]).optional(),
  type: z.string(),
  name: z.string(),
  index: z.union([z.string(), z.number()]).optional(),
  provider_name: z.string(),
  schema_version: z.number().optional(),
  values: z.record(z.unknown()).optional(),
  sensitive_values: z.record(z.unknown()).optional(),
  depends_on: z.array(z.string()).optional(),
});
export type TerraformResourceValue = z.infer<typeof TerraformResourceValueSchema>;

export type TerraformModuleValue = {
  address?: string;
  resources?: TerraformResourceValue[];
  child_modules?: TerraformModuleValue[];
};

export const TerraformModuleValueSchema: z.ZodType<TerraformModuleValue> = z.lazy(() =>
  z.object({
    address: z.string().optional(),
    resources: z.array(TerraformResourceValueSchema).optional(),
    child_modules: z.array(TerraformModuleValueSchema).optional(),
  }),
);

export const TerraformValuesRepresentationSchema = z.object({
  root_module: TerraformModuleValueSchema.optional(),
  outputs: z.record(z.unknown()).optional(),
});
export type TerraformValuesRepresentation = z.infer<typeof TerraformValuesRepresentationSchema>;

export const TerraformChangeRepresentationSchema = z.object({
  actions: z.array(z.string()),
  before: z.record(z.unknown()).nullable().optional(),
  after: z.record(z.unknown()).nullable().optional(),
  after_unknown: z.record(z.unknown()).optional(),
  before_sensitive: z.union([z.boolean(), z.record(z.unknown())]).optional(),
  after_sensitive: z.union([z.boolean(), z.record(z.unknown())]).optional(),
  replace_paths: z.array(z.array(z.union([z.string(), z.number()]))).optional(),
});
export type TerraformChangeRepresentation = z.infer<typeof TerraformChangeRepresentationSchema>;

export const TerraformResourceChangeSchema = z.object({
  address: z.string(),
  previous_address: z.string().optional(),
  module_address: z.string().optional(),
  mode: z.enum(["managed", "data"]).default("managed"),
  type: z.string(),
  name: z.string(),
  index: z.union([z.string(), z.number()]).optional(),
  provider_name: z.string().optional(),
  deposed: z.string().optional(),
  change: TerraformChangeRepresentationSchema,
  action_reason: z.string().optional(),
});
export type TerraformResourceChange = z.infer<typeof TerraformResourceChangeSchema>;

export const ExpressionRepresentationSchema = z.object({
  constant_value: z.unknown().optional(),
  references: z.array(z.string()).optional(),
});

export type BlockExpressionsRepresentation = {
  [key: string]:
    | z.infer<typeof ExpressionRepresentationSchema>
    | BlockExpressionsRepresentation
    | Array<z.infer<typeof ExpressionRepresentationSchema> | BlockExpressionsRepresentation>
    | unknown;
};

export const TerraformResourceConfigSchema = z.object({
  address: z.string(),
  mode: z.enum(["managed", "data"]).optional(),
  type: z.string(),
  name: z.string(),
  provider_config_key: z.string().optional(),
  expressions: z.record(z.unknown()).optional(),
  schema_version: z.number().optional(),
  count_expression: z.unknown().optional(),
  for_each_expression: z.unknown().optional(),
  depends_on: z.array(z.string()).optional(),
});
export type TerraformResourceConfig = z.infer<typeof TerraformResourceConfigSchema>;

export type TerraformModuleConfig = {
  resources?: TerraformResourceConfig[];
  outputs?: Record<string, { expression?: { references?: string[] }; sensitive?: boolean }>;
  module_calls?: Record<
    string,
    {
      resolved_source?: string;
      expressions?: Record<string, unknown>;
      module?: TerraformModuleConfig;
    }
  >;
};

export const TerraformModuleConfigSchema: z.ZodType<TerraformModuleConfig> = z.lazy(() =>
  z.object({
    resources: z.array(TerraformResourceConfigSchema).optional(),
    outputs: z
      .record(
        z.object({
          expression: z.object({ references: z.array(z.string()).optional() }).optional(),
          sensitive: z.boolean().optional(),
        }),
      )
      .optional(),
    module_calls: z
      .record(
        z.object({
          resolved_source: z.string().optional(),
          expressions: z.record(z.unknown()).optional(),
          module: TerraformModuleConfigSchema.optional(),
        }),
      )
      .optional(),
  }),
);

export const TerraformConfigurationSchema = z.object({
  provider_config: z.record(z.unknown()).optional(),
  root_module: TerraformModuleConfigSchema.optional(),
});
export type TerraformConfiguration = z.infer<typeof TerraformConfigurationSchema>;

/** State JSON output (terraform show -json <statefile>) */
export const TerraformStateFileSchema = z.object({
  format_version: z.string(),
  terraform_version: z.string().optional(),
  values: TerraformValuesRepresentationSchema,
});
export type TerraformStateFile = z.infer<typeof TerraformStateFileSchema>;

/** Plan JSON output (terraform show -json <planfile>) */
export const TerraformPlanFileSchema = z.object({
  format_version: z.string(),
  terraform_version: z.string().optional(),
  planned_values: TerraformValuesRepresentationSchema.optional(),
  prior_state: z.unknown().optional(),
  resource_changes: z.array(TerraformResourceChangeSchema).optional(),
  configuration: TerraformConfigurationSchema.optional(),
  output_changes: z.record(z.unknown()).optional(),
  proposed_unknown: z.unknown().optional(),
  resource_drift: z.array(z.unknown()).optional(),
  relevant_attributes: z.array(z.unknown()).optional(),
  checks: z.array(z.unknown()).optional(),
  timestamp: z.string().optional(),
  applyable: z.boolean().optional(),
  complete: z.boolean().optional(),
  errored: z.boolean().optional(),
});
export type TerraformPlanFile = z.infer<typeof TerraformPlanFileSchema>;

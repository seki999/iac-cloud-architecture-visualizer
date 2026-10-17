import { z } from "zod";

export const KnowledgeStateSchema = z.enum(["known", "inferred", "unknown"]);
export type KnowledgeState = z.infer<typeof KnowledgeStateSchema>;

export const RelationshipTypeSchema = z.enum([
  "contains",
  "attached_to",
  "associated_with",
  "depends_on",
  "routes_to",
  "targets",
  "references",
  "possible_network_access",
]);
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

export const TerraformActionSchema = z.enum(["no-op", "create", "read", "update", "delete"]);
export type TerraformAction = z.infer<typeof TerraformActionSchema>;

export const EvidenceSourceSchema = z.enum([
  "state_value",
  "plan_value",
  "configuration_reference",
  "provider_rule",
  "user_annotation",
]);
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const EvidenceSchema = z.object({
  source: EvidenceSourceSchema,
  resourceAddress: z.string().optional(),
  attributePath: z.string().optional(),
  ruleId: z.string().optional(),
  description: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ScopeSchema = z.object({
  accountId: z.string().optional(),
  region: z.string().optional(),
  vpcId: z.string().optional(),
  subnetIds: z.array(z.string()).optional(),
  availabilityZones: z.array(z.string()).optional(),
});
export type Scope = z.infer<typeof ScopeSchema>;

export const NodeChangeSchema = z.object({
  actions: z.array(TerraformActionSchema),
  actionReason: z.string().optional(),
  replacePaths: z.array(z.array(z.union([z.string(), z.number()]))).optional(),
  previousAddress: z.string().optional(),
  deposed: z.string().optional(),
});
export type NodeChange = z.infer<typeof NodeChangeSchema>;

export const InfraNodeSchema = z.object({
  id: z.string(),
  address: z.string(),
  provider: z.string(),
  resourceType: z.string(),
  resourceName: z.string(),
  mode: z.enum(["managed", "data"]),
  moduleAddress: z.string().optional(),
  scope: ScopeSchema.optional(),
  attributes: z.record(z.unknown()),
  knowledge: KnowledgeStateSchema,
  change: NodeChangeSchema.optional(),
  evidence: z.array(EvidenceSchema).default([]),
  aggregatedAddresses: z.array(z.string()).optional(),
  unknownAttributePaths: z.array(z.string()).optional(),
  /** Plan expression paths with a reference that resolved to no resource (var, local, each.value, ...). */
  unresolvedReferencePaths: z.array(z.string()).optional(),
});
export type InfraNode = z.infer<typeof InfraNodeSchema>;

export const InfraEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: RelationshipTypeSchema,
  knowledge: KnowledgeStateSchema,
  evidence: z.array(EvidenceSchema).default([]),
});
export type InfraEdge = z.infer<typeof InfraEdgeSchema>;

export const EngineKindSchema = z.enum(["terraform", "opentofu", "unknown"]);
export type EngineKind = z.infer<typeof EngineKindSchema>;

export const SourceKindSchema = z.enum(["state", "plan"]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const InfraGraphSourceSchema = z.object({
  engine: EngineKindSchema,
  kind: SourceKindSchema,
  terraformVersion: z.string().optional(),
  formatVersion: z.string().optional(),
});
export type InfraGraphSource = z.infer<typeof InfraGraphSourceSchema>;

export const InfraGraphSchema = z.object({
  schemaVersion: z.literal("1.0"),
  source: InfraGraphSourceSchema,
  nodes: z.array(InfraNodeSchema),
  edges: z.array(InfraEdgeSchema),
  warnings: z.array(z.string()).default([]),
});
export type InfraGraph = z.infer<typeof InfraGraphSchema>;

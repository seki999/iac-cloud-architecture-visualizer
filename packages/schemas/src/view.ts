import { z } from "zod";
import { KnowledgeStateSchema, RelationshipTypeSchema, ScopeSchema, EvidenceSchema } from "./graph.js";

export const ViewRoleSchema = z.enum(["container", "node", "annotation", "detail-only"]);
export type ViewRole = z.infer<typeof ViewRoleSchema>;

export const ViewNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  resourceAddress: z.string(),
  resourceType: z.string(),
  category: z.string(),
  iconKey: z.string().optional(),
  layoutParentId: z.string().optional(),
  semanticScope: ScopeSchema.optional(),
  isContainer: z.boolean().default(false),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  knowledge: KnowledgeStateSchema.default("known"),
  metadata: z.record(z.unknown()).default({}),
  aggregatedAddresses: z.array(z.string()).optional(),
  isAggregated: z.boolean().default(false),
  tier: z.string().optional(),
  subtitle: z.string().optional(),
});
export type ViewNode = z.infer<typeof ViewNodeSchema>;

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Point = z.infer<typeof PointSchema>;

export const ViewEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  type: RelationshipTypeSchema,
  knowledge: KnowledgeStateSchema.default("known"),
  waypoints: z.array(PointSchema).optional(),
  evidence: z.array(EvidenceSchema).default([]),
});
export type ViewEdge = z.infer<typeof ViewEdgeSchema>;

export const ViewModelSchema = z.object({
  viewName: z.enum(["overview", "network", "all"]),
  title: z.string(),
  nodes: z.array(ViewNodeSchema),
  edges: z.array(ViewEdgeSchema),
  warnings: z.array(z.string()).default([]),
  stats: z.object({
    totalNodes: z.number(),
    totalEdges: z.number(),
    containerCount: z.number(),
  }),
});
export type ViewModel = z.infer<typeof ViewModelSchema>;

/** resourceType of synthetic, purely visual Availability Zone frames (never a Terraform resource). */
export const AZ_GROUP_TYPE = "iacviz_availability_zone";

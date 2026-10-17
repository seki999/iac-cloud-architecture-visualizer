import { z } from "zod";

export const DiagramLayoutConfigSchema = z.object({
  direction: z.enum(["LEFT_TO_RIGHT", "TOP_TO_BOTTOM"]).default("LEFT_TO_RIGHT"),
  spacing: z.number().finite().positive().default(40),
  nodeSpacing: z.number().finite().positive().default(40),
});
export type DiagramLayoutConfig = z.infer<typeof DiagramLayoutConfigSchema>;

export const AnnotationSchema = z.object({
  id: z.string(),
  targetAddress: z.string().optional(),
  text: z.string(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});
export type Annotation = z.infer<typeof AnnotationSchema>;

export const DiagramConfigSchema = z.object({
  schemaVersion: z.literal("1.0"),
  view: z.enum(["overview", "network", "all"]).default("overview"),
  layout: DiagramLayoutConfigSchema.default({ direction: "LEFT_TO_RIGHT", spacing: 40 }),
  collapsedGroups: z.array(z.string()).default([]),
  hiddenResourceAddresses: z.array(z.string()).default([]),
  manualPositions: z.record(z.object({ x: z.number().finite(), y: z.number().finite() })).default({}),
  annotations: z.array(AnnotationSchema).default([]),
});
export type DiagramConfig = z.infer<typeof DiagramConfigSchema>;

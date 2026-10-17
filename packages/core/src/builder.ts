import { createHash } from "node:crypto";
import type {
  InfraGraph,
  InfraNode,
  InfraEdge,
  InfraGraphSource,
  Evidence,
  RelationshipType,
  KnowledgeState,
  Scope,
  NodeChange,
} from "@iacviz/schemas";
import { InfraGraphSchema } from "@iacviz/schemas";
import { parseResourceAddress } from "./address.js";
import { sanitizeAttributes, sanitizeDisplayText } from "./sanitizer.js";

export interface CreateNodeOptions {
  address: string;
  identitySuffix?: string;
  unknownAttributePaths?: string[];
  provider: string;
  resourceType: string;
  resourceName: string;
  mode?: "managed" | "data";
  moduleAddress?: string;
  scope?: Scope;
  attributes?: Record<string, unknown>;
  sensitiveMap?: Record<string, unknown> | boolean;
  knowledge?: KnowledgeState;
  change?: NodeChange;
  evidence?: Evidence[];
  aggregatedAddresses?: string[];
}

export class InfraGraphBuilder {
  private readonly nodes = new Map<string, InfraNode>();
  private readonly edges = new Map<string, InfraEdge>();
  private readonly warnings: string[] = [];
  private readonly source: InfraGraphSource;

  constructor(source: InfraGraphSource) {
    this.source = source;
  }

  /**
   * Deterministic ID generation based on canonical address.
   */
  public static makeNodeId(address: string): string {
    const parsed = parseResourceAddress(address);
    // Replace special characters with hyphens for clean diagramming
    return "n_" + createHash("sha256").update(parsed.canonicalAddress).digest("hex");
  }

  public static makeEdgeId(source: string, target: string, type: RelationshipType): string {
    return `${source}-->${type}-->${target}`;
  }

  public addNode(options: CreateNodeOptions): InfraNode {
    const id = InfraGraphBuilder.makeNodeId(options.address + (options.identitySuffix ?? ""));
    const existing = this.nodes.get(id);

    const parsed = parseResourceAddress(options.address);
    const cleanAttrs = sanitizeAttributes(options.attributes, options.sensitiveMap);

    if (existing) {
      // Merge change actions and evidence
      if (options.change && !existing.change) {
        existing.change = options.change;
      }
      if (options.evidence) {
        existing.evidence.push(...options.evidence);
      }
      // Merge scope if newly discovered
      if (options.scope) {
        existing.scope = { ...existing.scope, ...options.scope };
      }
      return existing;
    }

    const node: InfraNode = {
      id,
      address: parsed.canonicalAddress,
      provider: options.provider,
      resourceType: options.resourceType,
      resourceName: sanitizeDisplayText(options.resourceName),
      mode: options.mode ?? parsed.mode,
      moduleAddress: options.moduleAddress ?? parsed.moduleAddress,
      scope: {
        vpcId: typeof cleanAttrs.vpc_id === "string" ? cleanAttrs.vpc_id : undefined,
        subnetIds: Array.isArray(cleanAttrs.subnet_ids)
          ? (cleanAttrs.subnet_ids as string[])
          : typeof cleanAttrs.subnet_id === "string"
            ? [cleanAttrs.subnet_id]
            : Array.isArray(cleanAttrs.subnets)
              ? (cleanAttrs.subnets as string[])
              : undefined,
        availabilityZones:
          typeof cleanAttrs.availability_zone === "string" ? [cleanAttrs.availability_zone] : undefined,
      },
      attributes: cleanAttrs,
      knowledge: options.knowledge ?? "known",
      change: options.change,
      evidence: options.evidence ?? [],
      aggregatedAddresses: options.aggregatedAddresses,
      unknownAttributePaths: options.unknownAttributePaths,
    };

    this.nodes.set(id, node);
    return node;
  }

  public getNode(idOrAddress: string): InfraNode | undefined {
    return this.nodes.get(idOrAddress) ?? this.nodes.get(InfraGraphBuilder.makeNodeId(idOrAddress));
  }

  public hasNode(idOrAddress: string): boolean {
    return this.getNode(idOrAddress) !== undefined;
  }

  public getAllNodes(): InfraNode[] {
    return Array.from(this.nodes.values());
  }

  public addEdge(
    sourceAddressOrId: string,
    targetAddressOrId: string,
    type: RelationshipType,
    evidence: Evidence[],
    knowledge: KnowledgeState = "known",
  ): InfraEdge {
    const sourceNode = this.getNode(sourceAddressOrId);
    const targetNode = this.getNode(targetAddressOrId);

    const sourceId = sourceNode ? sourceNode.id : InfraGraphBuilder.makeNodeId(sourceAddressOrId);
    const targetId = targetNode ? targetNode.id : InfraGraphBuilder.makeNodeId(targetAddressOrId);

    const edgeId = InfraGraphBuilder.makeEdgeId(sourceId, targetId, type);
    const existing = this.edges.get(edgeId);

    if (existing) {
      existing.evidence.push(...evidence);
      return existing;
    }

    const edge: InfraEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type,
      knowledge,
      evidence,
    };

    this.edges.set(edgeId, edge);
    return edge;
  }

  public getAllEdges(): InfraEdge[] {
    return Array.from(this.edges.values());
  }

  public addWarning(warning: string): void {
    if (!this.warnings.includes(warning)) {
      this.warnings.push(warning);
    }
  }

  public getWarnings(): string[] {
    return [...this.warnings];
  }

  public build(): InfraGraph {
    const graph: InfraGraph = {
      schemaVersion: "1.0",
      source: this.source,
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
      warnings: this.getWarnings(),
    };

    const clean = (value: unknown): unknown => {
      if (typeof value === "string") return sanitizeDisplayText(value);
      if (Array.isArray(value)) return value.map(clean);
      if (value && typeof value === "object")
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [sanitizeDisplayText(k), clean(v)]));
      return value;
    };
    return InfraGraphSchema.parse(clean(graph));
  }
}

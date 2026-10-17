import type { ViewModel, ViewNode } from "@iacviz/schemas";
import { hasAzFrames, layoutAzGrid, type Size } from "./az-grid.js";
import ELKConstructor from "elkjs/lib/elk.bundled.js";

const ELK = ELKConstructor;
import type { ElkNode, ElkExtendedEdge as ElkEdge } from "elkjs/lib/elk-api.js";

export interface LayoutOptions {
  direction?: "LEFT_TO_RIGHT" | "TOP_TO_BOTTOM";
  nodeSpacing?: number;
  layerSpacing?: number;
}

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 90;
const CONTAINER_MIN_WIDTH = 340;
const CONTAINER_MIN_HEIGHT = 160;

/**
 * Executes automatic compound layout using ELKjs with deterministic fallback.
 *
 * VPCs split into AZ frames (Network view) are arranged bottom-up by az-grid and then treated
 * as fixed-size blocks by the root ELK pass. Edges into such blocks get no ELK waypoints;
 * diagrams.net routes them orthogonally between the attached terminals.
 */
export async function layoutViewModel(viewModel: ViewModel, options: LayoutOptions = {}): Promise<ViewModel> {
  const direction = options.direction ?? "LEFT_TO_RIGHT";
  const elkDirection = direction === "TOP_TO_BOTTOM" ? "DOWN" : "RIGHT";

  // Build a tree of view nodes
  const nodeMap = new Map<string, ViewNode>();
  for (const n of viewModel.nodes) {
    nodeMap.set(n.id, n);
  }

  // Group nodes by layoutParentId
  const childrenByParent = new Map<string, ViewNode[]>();
  const rootNodes: ViewNode[] = [];

  for (const node of viewModel.nodes) {
    if (node.layoutParentId && nodeMap.has(node.layoutParentId)) {
      const list = childrenByParent.get(node.layoutParentId) ?? [];
      list.push(node);
      childrenByParent.set(node.layoutParentId, list);
    } else {
      rootNodes.push(node);
    }
  }
  const childrenOf = (id: string) => childrenByParent.get(id) ?? [];

  // Pre-arranged blocks: laid out before the root pass and treated as leaves by ELK.
  const fixed = new Map<string, Size>();

  function toElkNode(n: ViewNode): ElkNode {
    const block = fixed.get(n.id);
    if (block) return { id: n.id, labels: [{ text: n.label }], width: block.width, height: block.height };
    const children = childrenByParent.get(n.id);
    const hasChildren = Boolean(children && children.length > 0);

    const elkNode: ElkNode = {
      id: n.id,
      labels: [{ text: n.label }],
      width: n.isContainer ? CONTAINER_MIN_WIDTH : DEFAULT_NODE_WIDTH,
      height: n.isContainer ? CONTAINER_MIN_HEIGHT : DEFAULT_NODE_HEIGHT,
    };

    if (hasChildren || n.isContainer) {
      elkNode.layoutOptions = {
        "elk.algorithm": "layered",
        "elk.nodeSize.constraints": "MINIMUM_SIZE",
        "elk.nodeSize.minimum": "(340,160)",
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
        "elk.direction": elkDirection,
        "elk.padding": "[top=90,left=30,bottom=30,right=30]",
        "elk.spacing.nodeNode": String(options.nodeSpacing ?? 30),
        "elk.layered.spacing.nodeNodeBetweenLayers": String(options.layerSpacing ?? 50),
      };
      elkNode.children = (children ?? []).map(toElkNode);
    } else {
      elkNode.width = DEFAULT_NODE_WIDTH;
      elkNode.height = DEFAULT_NODE_HEIGHT;
    }

    return elkNode;
  }

  const isAncestor = (a: string, b: string): boolean => {
    const seen = new Set<string>();
    let parent = nodeMap.get(b)?.layoutParentId;
    while (parent && !seen.has(parent)) {
      if (parent === a) return true;
      seen.add(parent);
      parent = nodeMap.get(parent)?.layoutParentId;
    }
    return false;
  };
  /** Nearest self-or-ancestor that is a fixed block, so edges can attach to the block itself. */
  const blockOf = (id: string): string | undefined => {
    const seen = new Set<string>();
    let current: string | undefined = id;
    while (current && !seen.has(current)) {
      if (fixed.has(current)) return current;
      seen.add(current);
      current = nodeMap.get(current)?.layoutParentId;
    }
    return undefined;
  };

  function applyPositions(elkN: ElkNode) {
    const original = nodeMap.get(elkN.id);
    if (original) {
      original.x = Math.round(elkN.x ?? 0);
      original.y = Math.round(elkN.y ?? 0);
      original.width = Math.round(elkN.width ?? DEFAULT_NODE_WIDTH);
      original.height = Math.round(elkN.height ?? DEFAULT_NODE_HEIGHT);
    }
    for (const c of elkN.children ?? []) applyPositions(c);
  }

  try {
    const elk = new ELK();

    /** Lays out sibling nodes (with their subtrees) as one detached graph; positions are graph-local. */
    async function layoutDetached(nodes: ViewNode[], bandDirection = elkDirection): Promise<Size> {
      const inside = new Set<string>();
      const collect = (n: ViewNode) => {
        inside.add(n.id);
        childrenOf(n.id).forEach(collect);
      };
      nodes.forEach(collect);
      const graph: ElkNode = {
        id: "detached",
        layoutOptions: {
          "elk.hierarchyHandling": "INCLUDE_CHILDREN",
          "elk.algorithm": "layered",
          "elk.direction": bandDirection,
          "elk.spacing.nodeNode": String(options.nodeSpacing ?? 30),
          "elk.layered.spacing.nodeNodeBetweenLayers": String(options.layerSpacing ?? 50),
          "elk.padding": "[top=0,left=0,bottom=0,right=0]",
        },
        children: nodes.map(toElkNode),
        edges: viewModel.edges
          .filter((e) => inside.has(e.source) && inside.has(e.target))
          .filter((e) => !isAncestor(e.source, e.target) && !isAncestor(e.target, e.source))
          .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
      };
      const result = await elk.layout(graph);
      for (const c of result.children ?? []) applyPositions(c);
      return { width: Math.round(result.width ?? 0), height: Math.round(result.height ?? 0) };
    }

    // Phase 1: AZ-framed VPCs, innermost first so nested blocks are measured before their parents.
    const depth = (n: ViewNode): number => {
      let d = 0;
      const seen = new Set<string>();
      for (let p = n.layoutParentId; p && !seen.has(p); p = nodeMap.get(p)?.layoutParentId) {
        seen.add(p);
        d++;
      }
      return d;
    };
    const blocks = viewModel.nodes
      .filter((n) => hasAzFrames(childrenByParent.get(n.id)))
      .sort((a, b) => depth(b) - depth(a) || a.id.localeCompare(b.id));
    for (const vpc of blocks) {
      const size = await layoutAzGrid({
        vpc,
        children: childrenOf(vpc.id),
        childrenOf,
        measure: async (node) => {
          if (!node.isContainer && !childrenOf(node.id).length)
            return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
          const size = await layoutDetached([node]);
          return { width: node.width ?? size.width, height: node.height ?? size.height };
        },
        // The band sits above AZ columns: spread it horizontally (layers run downwards).
        layoutBand: (nodes) => layoutDetached(nodes, "DOWN"),
      });
      fixed.set(vpc.id, size);
      vpc.width = size.width;
      vpc.height = size.height;
    }

    // Phase 2: root pass. Edges touching a block's interior attach to the block for layering only.
    const routed = new Set<string>();
    const seenPairs = new Set<string>();
    const elkEdges: ElkEdge[] = [];
    for (const e of viewModel.edges) {
      const source = blockOf(e.source) ?? e.source;
      const target = blockOf(e.target) ?? e.target;
      if (source === target || isAncestor(source, target) || isAncestor(target, source)) continue;
      const direct = source === e.source && target === e.target;
      if (direct) {
        routed.add(e.id);
        elkEdges.push({ id: e.id, sources: [source], targets: [target] });
      } else if (!seenPairs.has(source + "|" + target)) {
        seenPairs.add(source + "|" + target);
        elkEdges.push({ id: `block:${source}|${target}`, sources: [source], targets: [target] });
      }
    }

    const rootElkGraph: ElkNode = {
      id: "root",
      layoutOptions: {
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
        "elk.algorithm": "layered",
        "elk.direction": elkDirection,
        "elk.spacing.nodeNode": String(options.nodeSpacing ?? 40),
        "elk.layered.spacing.nodeNodeBetweenLayers": String(options.layerSpacing ?? 60),
        "elk.padding": "[top=40,left=40,bottom=40,right=40]",
      },
      children: rootNodes.map(toElkNode),
      edges: elkEdges,
    };
    const laidOutGraph = await elk.layout(rootElkGraph);
    for (const c of laidOutGraph.children ?? []) applyPositions(c);

    // Waypoints only for edges ELK routed end to end in root coordinates.
    const elkById = new Map((laidOutGraph.edges ?? []).map((e) => [e.id, e]));
    for (const edge of viewModel.edges) {
      const section = routed.has(edge.id) ? elkById.get(edge.id)?.sections?.[0] : undefined;
      if (section) {
        edge.waypoints = (section.bendPoints ?? []).map((b) => ({ x: Math.round(b.x), y: Math.round(b.y) }));
      } else {
        delete edge.waypoints;
      }
    }

    return viewModel;
  } catch {
    // Fallback: deterministic grid layout if ELK fails
    viewModel.warnings.push("ELK layout failed; deterministic grouped fallback used.");
    return fallbackGridLayout(viewModel, options);
  }
}

/**
 * Deterministic grid layout fallback.
 * Ensures all nodes and containers are visible without overlaps even if ELK fails.
 */
export function fallbackGridLayout(viewModel: ViewModel, _options: LayoutOptions = {}): ViewModel {
  const byParent = new Map<string, ViewNode[]>();
  const ids = new Set(viewModel.nodes.map((n) => n.id));
  for (const node of viewModel.nodes) {
    const parent = node.layoutParentId && ids.has(node.layoutParentId) ? node.layoutParentId : "root";
    const list = byParent.get(parent) ?? [];
    list.push(node);
    byParent.set(parent, list);
  }
  function arrange(parent: string): { width: number; height: number } {
    const children = byParent.get(parent) ?? [];
    let y = parent === "root" ? 40 : 90;
    let width = 340;
    for (const child of children) {
      const inner = arrange(child.id);
      child.width = child.isContainer ? inner.width : DEFAULT_NODE_WIDTH;
      child.height = child.isContainer ? inner.height : DEFAULT_NODE_HEIGHT;
      child.x = 30;
      child.y = y;
      y += child.height + 40;
      width = Math.max(width, child.width + 60);
    }
    return { width, height: Math.max(160, y) };
  }
  arrange("root");
  for (const edge of viewModel.edges) delete edge.waypoints;
  return viewModel;
}

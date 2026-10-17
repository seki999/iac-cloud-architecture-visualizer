import { AZ_GROUP_TYPE, type ViewNode } from "@iacviz/schemas";

/**
 * Deterministic interior arrangement for a VPC that the Network view split into AZ frames.
 *
 * Layered layout chains AZ frames one after another (a VPC-level route table links subnets
 * in every AZ), which yields very tall diagrams. Network diagrams conventionally show AZs
 * side by side, so this places AZ frames as columns and aligns subnets of the same routing
 * class (derived from route evidence, never from names) in shared rows across columns.
 */

export interface Size {
  width: number;
  height: number;
}

export interface AzGridInput {
  vpc: ViewNode;
  children: ViewNode[];
  childrenOf: (id: string) => ViewNode[];
  /** Lays out a node's own subtree and returns its size (leaf nodes return their default size). */
  measure: (node: ViewNode) => Promise<Size>;
  /** Lays out VPC-level, non-AZ children as one band and returns its size; positions are band-local. */
  layoutBand: (nodes: ViewNode[]) => Promise<Size>;
}

const PAD = 30;
const VPC_HEADER = 90;
const AZ_HEADER = 60;
const GAP = 40;
const ROW_GAP = 30;
const MIN_WIDTH = 340;

const TIER_RANK: Record<string, number> = {
  public: 0,
  "private-nat-egress": 1,
  "private-hybrid": 2,
  "private-no-default-egress": 3,
  unknown: 4,
};

const rank = (node: ViewNode) =>
  node.resourceType === "aws_subnet" ? (TIER_RANK[node.tier ?? "unknown"] ?? 4) : 5;

export function hasAzFrames(children: ViewNode[] | undefined): boolean {
  return Boolean(children?.some((c) => c.resourceType === AZ_GROUP_TYPE));
}

export async function layoutAzGrid(input: AzGridInput): Promise<Size> {
  const azs = input.children.filter((c) => c.resourceType === AZ_GROUP_TYPE);
  const others = input.children.filter((c) => c.resourceType !== AZ_GROUP_TYPE);

  const band = others.length ? await input.layoutBand(others) : { width: 0, height: 0 };
  for (const node of others) {
    node.x = (node.x ?? 0) + PAD;
    node.y = (node.y ?? 0) + VPC_HEADER;
  }

  // Rows are keyed by (routing class, n-th subnet of that class within the AZ).
  type Cell = { node: ViewNode; size: Size; key: string };
  const columns: { az: ViewNode; cells: Cell[] }[] = [];
  const rowHeights = new Map<string, number>();
  const rowOrder = new Map<string, [number, number]>();
  for (const az of azs) {
    const members = [...input.childrenOf(az.id)].sort(
      (a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id),
    );
    const seen = new Map<number, number>();
    const cells: Cell[] = [];
    for (const node of members) {
      const r = rank(node);
      const index = seen.get(r) ?? 0;
      seen.set(r, index + 1);
      const key = `${r}:${index}`;
      const size = await input.measure(node);
      cells.push({ node, size, key });
      rowHeights.set(key, Math.max(rowHeights.get(key) ?? 0, size.height));
      rowOrder.set(key, [r, index]);
    }
    columns.push({ az, cells });
  }
  const rows = [...rowOrder.entries()]
    .sort((a, b) => a[1][0] - b[1][0] || a[1][1] - b[1][1])
    .map(([key]) => key);
  const rowY = new Map<string, number>();
  let y = AZ_HEADER;
  for (const key of rows) {
    rowY.set(key, y);
    y += (rowHeights.get(key) ?? 0) + ROW_GAP;
  }
  const azHeight = Math.max(160, y - ROW_GAP + PAD);

  const azTop = VPC_HEADER + (band.height ? band.height + GAP : 0);
  let x = PAD;
  for (const { az, cells } of columns) {
    const inner = Math.max(MIN_WIDTH - 2 * PAD, ...cells.map((c) => c.size.width));
    for (const cell of cells) {
      cell.node.x = PAD;
      cell.node.y = rowY.get(cell.key) ?? AZ_HEADER;
      // Containers stretch to the column so the same tier lines up; leaves keep their size.
      cell.node.width = cell.node.isContainer ? inner : cell.size.width;
      cell.node.height = cell.node.isContainer
        ? (rowHeights.get(cell.key) ?? cell.size.height)
        : cell.size.height;
    }
    az.x = x;
    az.y = azTop;
    az.width = inner + 2 * PAD;
    az.height = azHeight;
    x += az.width + GAP;
  }

  const width = Math.max(MIN_WIDTH, band.width + 2 * PAD, x - GAP + PAD);
  const height = azs.length ? azTop + azHeight + PAD : VPC_HEADER + band.height + PAD;
  return { width, height };
}

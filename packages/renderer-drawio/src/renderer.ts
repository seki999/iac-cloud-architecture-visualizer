import { XMLBuilder } from "fast-xml-parser";
import { AZ_GROUP_TYPE, type ViewModel, type ViewNode, type ViewEdge } from "@iacviz/schemas";
import {
  getAwsIcon,
  getDrawioStyle,
  groupStyle,
  iconCellStyle,
  type AwsGroupKind,
} from "@iacviz/providers-aws";

const ICON_SIZE = 40;

function groupKind(node: ViewNode): AwsGroupKind {
  if (node.resourceType === "aws_vpc") return "vpc";
  if (node.resourceType === AZ_GROUP_TYPE) return "az";
  if (node.resourceType !== "aws_subnet") return "generic";
  if (node.tier === "public") return "subnet-public";
  return node.tier && node.tier !== "unknown" ? "subnet-private" : "subnet-unknown";
}

function style(node: ViewNode): string {
  if (node.isContainer) return groupStyle(groupKind(node));
  const colors = getDrawioStyle(node.iconKey);
  const lighten = (color: string) =>
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(parseInt(color.slice(i, i + 2), 16) * 0.1 + 255 * 0.9)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  const iconSpace = getAwsIcon(node.iconKey) ? `spacingLeft=${ICON_SIZE + 14};` : "";
  return (
    "whiteSpace=wrap;html=0;rounded=1;arcSize=8;fontSize=12;spacing=6;align=left;verticalAlign=middle;" +
    iconSpace +
    `fillColor=${lighten(colors.fillColor)};strokeColor=${colors.strokeColor};fontColor=${colors.fontColor};` +
    (node.knowledge === "known" ? "" : "dashed=1;")
  );
}

/** Decorative, non-connectable icon children; they move with the card and carry no resource data. */
function iconCells(nodes: ViewNode[]) {
  return nodes.flatMap((node) => {
    const icon = node.isContainer ? undefined : getAwsIcon(node.iconKey);
    if (!icon) return [];
    const height = node.height ?? 90;
    return [
      {
        "@_id": `${node.id}__icon`,
        "@_label": "",
        "@_decorative": "aws-icon",
        mxCell: {
          "@_style": iconCellStyle(icon),
          "@_vertex": "1",
          "@_parent": node.id,
          mxGeometry: {
            "@_x": 8,
            "@_y": Math.max(4, Math.round((height - ICON_SIZE) / 2)),
            "@_width": ICON_SIZE,
            "@_height": ICON_SIZE,
            "@_as": "geometry",
          },
        },
      },
    ];
  });
}
function edgeStyle(edge: ViewEdge): string {
  return (
    "edgeStyle=orthogonalEdgeStyle;html=0;endArrow=block;" + (edge.knowledge !== "known" ? "dashed=1;" : "")
  );
}
/** XMLBuilder owns all escaping. Resource labels use plain text, disabling HTML payloads. */
export function renderDrawioXml(models: ViewModel[] | ViewModel): string {
  const list = Array.isArray(models) ? models : [models];
  const diagram = list.map((model, index) => {
    const ids = new Set(model.nodes.map((n) => n.id));
    const byId = new Map(model.nodes.map((n) => [n.id, n]));
    const depth = (n: ViewNode): number => {
      const seen = new Set<string>();
      let parent = n.layoutParentId;
      while (parent && byId.has(parent) && !seen.has(parent)) {
        seen.add(parent);
        parent = byId.get(parent)?.layoutParentId;
      }
      return seen.size;
    };
    const orderedNodes = [...model.nodes].sort((a, b) => depth(a) - depth(b) || a.id.localeCompare(b.id));
    const object = orderedNodes.map((node) => ({
      "@_id": node.id,
      "@_label": [node.label, node.subtitle].filter(Boolean).join("\n"),
      "@_terraform_address": node.resourceAddress,
      "@_resource_type": node.resourceType,
      "@_knowledge_state": node.knowledge,
      "@_category": node.category,
      "@_metadata": JSON.stringify(node.metadata),
      "@_semantic_scope": JSON.stringify(node.semanticScope ?? {}),
      "@_aggregated_resources": JSON.stringify(node.aggregatedAddresses ?? []),
      mxCell: {
        "@_style": style(node),
        "@_vertex": "1",
        "@_parent": node.layoutParentId && ids.has(node.layoutParentId) ? node.layoutParentId : "1",
        mxGeometry: {
          "@_x": node.x ?? 40,
          "@_y": (node.y ?? 40) + (node.layoutParentId && ids.has(node.layoutParentId) ? 0 : 90),
          "@_width": node.width ?? 180,
          "@_height": node.height ?? 90,
          "@_as": "geometry",
        },
      },
    }));
    const edges = model.edges.map((edge) => ({
      "@_id": edge.id,
      "@_label": edge.label ?? "",
      "@_relationship_type": edge.type,
      "@_knowledge_state": edge.knowledge,
      "@_evidence": JSON.stringify(edge.evidence),
      mxCell: {
        "@_style": edgeStyle(edge),
        "@_edge": "1",
        "@_parent": "1",
        "@_source": edge.source,
        "@_target": edge.target,
        mxGeometry: {
          "@_relative": "1",
          "@_as": "geometry",
          ...(edge.waypoints?.length
            ? {
                Array: {
                  "@_as": "points",
                  mxPoint: edge.waypoints.map((p) => ({ "@_x": p.x, "@_y": p.y + 90 })),
                },
              }
            : {}),
        },
      },
    }));
    const bottom =
      Math.max(
        200,
        ...model.nodes.filter((n) => !n.layoutParentId).map((n) => (n.y ?? 0) + (n.height ?? 90)),
      ) + 130;
    return {
      "@_id": `page_${index}_${model.viewName}`,
      "@_name": model.viewName === "overview" ? "Overview" : "Network",
      mxGraphModel: {
        "@_grid": "1",
        "@_gridSize": "10",
        "@_page": "1",
        "@_pageWidth": "1587",
        "@_pageHeight": "1123",
        root: {
          mxCell: [
            { "@_id": "0" },
            { "@_id": "1", "@_parent": "0" },
            {
              "@_id": "header_title",
              "@_value": model.title,
              "@_style": "text;html=0;align=left;fontSize=20;",
              "@_vertex": "1",
              "@_parent": "1",
              mxGeometry: { "@_x": 40, "@_y": 20, "@_width": 900, "@_height": 50, "@_as": "geometry" },
            },
            {
              "@_id": "legend",
              "@_value": [
                "Relationship legend: contains = scope; associated_with = binding; targets = configured target; routes_to = configured route. IaC-only references/depends_on are kept in the graph model and not drawn.",
                "Solid = known; dashed = inferred/unknown. Unknown IDs remain unresolved. Routes do not prove reachability. AZ frames group subnets by their recorded availability_zone only.",
                ...model.warnings,
              ].join("\n"),
              "@_style": "text;html=0;align=left;whiteSpace=wrap;",
              "@_vertex": "1",
              "@_parent": "1",
              mxGeometry: {
                "@_x": 40,
                "@_y": bottom,
                "@_width": 1200,
                "@_height": Math.max(100, model.warnings.length * 20 + 70),
                "@_as": "geometry",
              },
            },
          ],
          // Icons follow their parent cards so every parent is decoded first.
          object: [...edges, ...object, ...iconCells(orderedNodes)],
        },
      },
    };
  });
  const builder = new XMLBuilder({ ignoreAttributes: false, format: true, suppressEmptyNode: true });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    builder.build({ mxfile: { "@_host": "app.diagrams.net", "@_type": "device", diagram } }) +
    "\n"
  );
}

/**
 * AwsIconRegistry: maps rule icon keys to diagrams.net AWS 2021+ ("aws4") stencils.
 *
 * Every stencil name below was confirmed against `mxStencilRegistry` of app.diagrams.net
 * (checked 2026-10-17). Older or offline diagrams.net builds may lack some stencils, so the
 * renderer never relies on an icon alone: each resource is a native labelled card and the icon
 * is a decorative child cell. A missing stencil leaves the card readable.
 */
export interface AwsIcon {
  /** Full stencil name, e.g. "mxgraph.aws4.ec2". */
  stencil: string;
  /** "service" stencils are drawn via resourceIcon on a coloured tile; "resource" stencils are standalone. */
  kind: "service" | "resource";
  /** AWS category colour for the tile or glyph. */
  color: string;
}

export interface DrawioStyle {
  fillColor: string;
  strokeColor: string;
  fontColor: string;
}

const COMPUTE = "#ED7100";
const NETWORK = "#8C4FFF";
const DATABASE = "#C925D1";
const STORAGE = "#7AA116";
const SECURITY = "#DD344C";
const INTEGRATION = "#E7157B";
const GENERIC = "#545B64";

export const AWS_ICONS: Readonly<Record<string, AwsIcon>> = {
  "aws.vpc": { stencil: "mxgraph.aws4.vpc", kind: "resource", color: NETWORK },
  "aws.igw": { stencil: "mxgraph.aws4.internet_gateway", kind: "resource", color: NETWORK },
  // No dedicated egress-only stencil exists; the generic gateway glyph is used and the label says which.
  "aws.eigw": { stencil: "mxgraph.aws4.gateway", kind: "resource", color: NETWORK },
  "aws.nat": { stencil: "mxgraph.aws4.nat_gateway", kind: "resource", color: NETWORK },
  "aws.route_table": { stencil: "mxgraph.aws4.route_table", kind: "resource", color: NETWORK },
  "aws.vpc_endpoint": { stencil: "mxgraph.aws4.endpoints", kind: "resource", color: NETWORK },
  "aws.eni": { stencil: "mxgraph.aws4.elastic_network_interface", kind: "resource", color: NETWORK },
  "aws.nacl": { stencil: "mxgraph.aws4.network_access_control_list", kind: "resource", color: NETWORK },
  "aws.alb": { stencil: "mxgraph.aws4.application_load_balancer", kind: "resource", color: NETWORK },
  "aws.target_group": { stencil: "mxgraph.aws4.elastic_load_balancing", kind: "service", color: NETWORK },
  "aws.cloudfront": { stencil: "mxgraph.aws4.cloudfront", kind: "service", color: NETWORK },
  "aws.route53": { stencil: "mxgraph.aws4.route_53", kind: "service", color: NETWORK },
  "aws.security_group": { stencil: "mxgraph.aws4.security_group", kind: "resource", color: SECURITY },
  "aws.iam": { stencil: "mxgraph.aws4.role", kind: "resource", color: SECURITY },
  "aws.ec2": { stencil: "mxgraph.aws4.instance2", kind: "resource", color: COMPUTE },
  "aws.launch_template": { stencil: "mxgraph.aws4.ami", kind: "resource", color: COMPUTE },
  "aws.asg": { stencil: "mxgraph.aws4.auto_scaling2", kind: "resource", color: COMPUTE },
  "aws.lambda": { stencil: "mxgraph.aws4.lambda", kind: "service", color: COMPUTE },
  "aws.ecs_cluster": { stencil: "mxgraph.aws4.ecs", kind: "service", color: COMPUTE },
  "aws.ecs_service": { stencil: "mxgraph.aws4.ecs_service", kind: "resource", color: COMPUTE },
  "aws.ecs_task": { stencil: "mxgraph.aws4.ecs_task", kind: "resource", color: COMPUTE },
  "aws.eks": { stencil: "mxgraph.aws4.eks", kind: "service", color: COMPUTE },
  "aws.rds": { stencil: "mxgraph.aws4.rds", kind: "service", color: DATABASE },
  "aws.elasticache": { stencil: "mxgraph.aws4.elasticache", kind: "service", color: DATABASE },
  "aws.dynamodb": { stencil: "mxgraph.aws4.dynamodb", kind: "service", color: DATABASE },
  "aws.s3": { stencil: "mxgraph.aws4.s3", kind: "service", color: STORAGE },
  "aws.sqs": { stencil: "mxgraph.aws4.sqs", kind: "service", color: INTEGRATION },
  "aws.sns": { stencil: "mxgraph.aws4.sns", kind: "service", color: INTEGRATION },
};

/** Returns the verified icon for a key, or undefined so callers render a plain generic card. */
export function getAwsIcon(iconKey?: string): AwsIcon | undefined {
  return iconKey ? AWS_ICONS[iconKey] : undefined;
}

/** Card colours derived from the icon's AWS category; unknown keys get neutral grey. */
export function getDrawioStyle(iconKey?: string): DrawioStyle {
  const color = getAwsIcon(iconKey)?.color ?? GENERIC;
  return { fillColor: color, strokeColor: color, fontColor: "#16191F" };
}

/** diagrams.net style string for the decorative icon cell; colours are fixed constants, never user text. */
export function iconCellStyle(icon: AwsIcon): string {
  const common = "sketch=0;outlineConnect=0;dashed=0;aspect=fixed;pointerEvents=1;html=0;connectable=0;";
  return icon.kind === "service"
    ? `${common}shape=mxgraph.aws4.resourceIcon;resIcon=${icon.stencil};fillColor=${icon.color};strokeColor=#ffffff;gradientColor=none;`
    : `${common}shape=${icon.stencil};fillColor=${icon.color};strokeColor=none;gradientColor=none;`;
}

export type AwsGroupKind = "vpc" | "az" | "subnet-public" | "subnet-private" | "subnet-unknown" | "generic";

/** Official-looking AWS group containers (stencils verified like icons above). */
export function groupStyle(kind: AwsGroupKind): string {
  const base =
    "points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];" +
    "outlineConnect=0;html=0;whiteSpace=wrap;fontSize=12;fontStyle=0;container=1;collapsible=0;recursiveResize=0;" +
    "verticalAlign=top;align=left;spacingLeft=30;spacingTop=4;";
  switch (kind) {
    case "vpc":
      return `${base}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc2;strokeColor=#8C4FFF;fillColor=none;fontColor=#6B3FC9;dashed=0;`;
    case "az":
      return `${base}rounded=0;strokeColor=#147EBA;fillColor=none;fontColor=#147EBA;dashed=1;dashPattern=8 4;align=center;spacingLeft=0;`;
    case "subnet-public":
      return `${base}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#7AA116;fillColor=#F2F6E8;fontColor=#248814;dashed=0;`;
    case "subnet-private":
      return `${base}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#00A4A6;fillColor=#E6F6F7;fontColor=#147EBA;dashed=0;`;
    case "subnet-unknown":
      return `${base}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_subnet;strokeColor=#879196;fillColor=#F7F8F8;fontColor=#5A6B86;dashed=1;`;
    default:
      return `${base}rounded=1;arcSize=2;strokeColor=#879196;fillColor=none;fontColor=#5A6B86;dashed=1;spacingLeft=10;`;
  }
}

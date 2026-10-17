/**
 * Security & Sanitization engine:
 * 1. Attribute Allow-listing: Only curated, architectural attributes are admitted into InfraGraph.
 * 2. Sensitive Attribute Detection: Checks Terraform sensitive_values maps and scans for secret patterns.
 * 3. Tag filtering: Strips sensitive tag keys and values.
 * 4. XML escaping to eliminate injection attacks.
 */

const SENSITIVE_KEY_PATTERN =
  /(?:password|secret|token|api_key|access_key|private_key|credential|auth_token|ssh_key)/i;
const SENSITIVE_VAL_PATTERN = /(?:TEST_SECRET_DO_NOT_EXPORT|TOKEN_SECRET_DO_NOT_EXPORT)/i;

/** Common architectural attributes permitted into the model per provider */
export const GLOBAL_ALLOWED_ATTRIBUTES = new Set([
  "id",
  "name",
  "arn",
  "cidr_block",
  "cidr_ipv4",
  "cidr_ipv6",
  "availability_zone",
  "availability_zones",
  "vpc_id",
  "subnet_id",
  "subnet_ids",
  "subnets",
  "security_groups",
  "vpc_security_group_ids",
  "instance_type",
  "instance_class",
  "allocated_storage",
  "engine",
  "engine_version",
  "multi_az",
  "load_balancer_type",
  "internal",
  "port",
  "protocol",
  "target_type",
  "desired_count",
  "launch_type",
  "bucket",
  "min_size",
  "max_size",
  "desired_capacity",
  "tags",
  "route_table_id",
  "destination_cidr_block",
  "destination_ipv6_cidr_block",
  "ipv6_cidr_block",
  "gateway_id",
  "nat_gateway_id",
  "egress_only_gateway_id",
  "transit_gateway_id",
  "vpc_peering_connection_id",
  "db_subnet_group_name",
  "load_balancer_arn",
  "target_group_arn",
  "target_id",
  "vpc_zone_identifier",
  "cluster",
  "task_definition",
  "listener_arn",
  "security_group_id",
  "referenced_security_group_id",
  "route_table_ids",
  "network_acl_id",
  "cluster_name",
  "node_group_name",
  "cache_subnet_group_name",
]);

/**
 * Escapes characters for safe inclusion in XML attributes and text content.
 */
export function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  return (
    str
      // eslint-disable-next-line no-control-regex -- XML 1.0 forbids these control characters
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
  );
}

/**
 * Checks if a key or string value is inherently sensitive.
 */
export function isSensitiveKeyOrValue(key: string, value: unknown): boolean {
  if (SENSITIVE_KEY_PATTERN.test(key)) return true;
  if (typeof value === "string") {
    if (SENSITIVE_VAL_PATTERN.test(value)) return true;
  }
  return false;
}

/**
 * Sanitizes a tags map by removing or masking sensitive tags.
 */
export function sanitizeTags(tags: unknown): Record<string, string> {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(tags as Record<string, unknown>)) {
    if (isSensitiveKeyOrValue(k, v)) {
      continue; // Drop sensitive tags completely
    }
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      clean[k] = String(v);
    }
  }
  return clean;
}

/**
 * Extracts and sanitizes attributes from raw Terraform values.
 * Uses strict allow-listing, drops unapproved attributes, and masks sensitive entries.
 */
export function sanitizeAttributes(
  rawValues: Record<string, unknown> | null | undefined,
  sensitiveMap: Record<string, unknown> | boolean | undefined,
  customAllowedKeys?: Set<string>,
): Record<string, unknown> {
  if (!rawValues || typeof rawValues !== "object") return {};

  const allowedKeys =
    customAllowedKeys ?? new Set([...GLOBAL_ALLOWED_ATTRIBUTES, ...Object.keys(NESTED_KEYS)]);
  const sanitized: Record<string, unknown> = {};

  const isGloballySensitive = sensitiveMap === true;
  const sensitiveRecord =
    typeof sensitiveMap === "object" && sensitiveMap !== null
      ? (sensitiveMap as Record<string, unknown>)
      : {};

  for (const [key, val] of Object.entries(rawValues)) {
    // 1. Strict Allow-list check
    if (!allowedKeys.has(key)) {
      continue;
    }

    // 2. Sensitive flags in Terraform representation
    if (isGloballySensitive || sensitiveRecord[key] === true || isSensitiveKeyOrValue(key, val)) {
      sanitized[key] = "[SENSITIVE]";
      continue;
    }

    if (sensitiveRecord[key] && typeof sensitiveRecord[key] === "object") {
      // Conservatively drop a field with any nested sensitivity markers.
      if (hasSensitiveMarker(sensitiveRecord[key])) continue;
    }
    if (NESTED_KEYS[key]) {
      sanitized[key] = sanitizeNested(val, NESTED_KEYS[key]!);
      continue;
    }

    // 3. Special handling for tags
    if (key === "tags" && typeof val === "object" && val !== null) {
      sanitized[key] = sanitizeTags(val);
      continue;
    }

    // 4. Safe primitive and primitive array copying
    if (val === null && KEEP_NULL.has(key)) {
      sanitized[key] = null;
    } else if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      sanitized[key] = val;
    } else if (Array.isArray(val)) {
      // Only keep arrays of strings/numbers
      sanitized[key] = val.filter(
        (item) => (typeof item === "string" || typeof item === "number") && !isSensitiveKeyOrValue(key, item),
      );
    }
  }

  return sanitized;
}

/** Attributes whose explicit null is itself evidence (e.g. a subnet without any IPv6 CIDR). */
const KEEP_NULL = new Set(["ipv6_cidr_block"]);

const NESTED_KEYS: Record<string, string[]> = {
  route: [
    "cidr_block",
    "ipv6_cidr_block",
    "gateway_id",
    "nat_gateway_id",
    "egress_only_gateway_id",
    "transit_gateway_id",
    "vpc_peering_connection_id",
  ],
  action: ["type", "target_group_arn", "forward", "target_group", "arn", "weight"],
  vpc_config: ["subnet_ids", "security_group_ids", "vpc_id"],
  launch_template: ["id", "name", "version"],
  default_action: ["type", "target_group_arn", "forward", "target_group", "arn", "weight"],
  load_balancer: ["target_group_arn", "container_name", "container_port"],
  network_configuration: ["subnets", "security_groups", "assign_public_ip"],
  subnet_mapping: ["subnet_id"],
  access_logs: ["bucket", "enabled"],
};
function hasSensitiveMarker(value: unknown): boolean {
  if (value === true) return true;
  return !!value && typeof value === "object" && Object.values(value).some(hasSensitiveMarker);
}
function sanitizeNested(value: unknown, keys: string[]): unknown {
  if (Array.isArray(value)) return value.map((v) => sanitizeNested(v, keys));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k, v]) => keys.includes(k) && !isSensitiveKeyOrValue(k, v))
        .map(([k, v]) => [k, sanitizeNested(v, keys)]),
    );
  }
  return typeof value === "string" && isSensitiveKeyOrValue("", value) ? "[SENSITIVE]" : value;
}
export function sanitizeDisplayText(value: string): string {
  const clean = Array.from(value)
    .filter((ch) => {
      const cp = ch.codePointAt(0)!;
      return (
        cp === 9 ||
        cp === 10 ||
        cp === 13 ||
        (cp >= 32 && cp <= 0xd7ff) ||
        (cp >= 0xe000 && cp <= 0xfffd) ||
        (cp >= 0x10000 && cp <= 0x10ffff)
      );
    })
    .join("");
  return isSensitiveKeyOrValue("", clean) ? "[SENSITIVE]" : clean;
}

/** Remove unknown leaves while retaining known sibling facts and array positions. */
export function omitUnknownAttributes(
  values: Record<string, unknown> | null | undefined,
  mask: Record<string, unknown> | undefined,
): Record<string, unknown> {
  function prune(value: unknown, flag: unknown): unknown {
    if (flag === true) return undefined;
    if (Array.isArray(value))
      return value.map((v, i) => prune(v, Array.isArray(flag) ? flag[i] : undefined) ?? null);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).flatMap(([key, v]) => {
          const next = prune(
            v,
            flag && typeof flag === "object" ? (flag as Record<string, unknown>)[key] : undefined,
          );
          return next === undefined ? [] : [[key, next]];
        }),
      );
    return value;
  }
  return prune(values ?? {}, mask) as Record<string, unknown>;
}
export function unknownAttributePaths(mask: unknown, prefix = ""): string[] {
  if (mask === true) return [prefix];
  if (!mask || typeof mask !== "object") return [];
  return Object.entries(mask).flatMap(([key, value]) =>
    unknownAttributePaths(value, prefix ? prefix + "." + key : key),
  );
}

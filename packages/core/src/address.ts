/**
 * Parsed components of a Terraform resource address.
 * Examples:
 *  - "aws_vpc.main"
 *  - "aws_subnet.public[0]"
 *  - "module.child.aws_instance.foo"
 *  - "module.services[\"api\"].module.subservice[0].aws_security_group.sub"
 */
export interface ParsedAddress {
  raw: string;
  moduleAddress?: string;
  mode: "managed" | "data";
  resourceType: string;
  resourceName: string;
  index?: string | number;
  canonicalAddress: string;
}

const RESOURCE_PATTERN = /^(?:(data)\.)?([a-zA-Z0-9_]+)\.([a-zA-Z0-9_-]+)(?:\[(".*?"|\d+)\])?$/;

/**
 * Parses a full absolute Terraform resource address into its constituent parts.
 */
export function parseResourceAddress(address: string): ParsedAddress {
  const tokens = splitAddressSegments(address);
  let offset = 0;
  while (tokens[offset] === "module" && tokens[offset + 1]) offset += 2;
  const moduleAddress = offset ? tokens.slice(0, offset).join(".") : undefined;
  const remaining = tokens.slice(offset).join(".");

  const match = remaining.match(RESOURCE_PATTERN);
  if (!match) {
    // Fallback if unusual structure
    return {
      raw: address,
      moduleAddress,
      mode: address.startsWith("data.") ? "data" : "managed",
      resourceType: "unknown",
      resourceName: remaining,
      canonicalAddress: address,
    };
  }

  const isData = Boolean(match[1]);
  const resourceType = match[2] ?? "unknown";
  const resourceName = match[3] ?? "unknown";
  const rawIndex = match[4];

  let index: string | number | undefined;
  if (rawIndex !== undefined) {
    if (rawIndex.startsWith('"') && rawIndex.endsWith('"')) {
      try {
        index = JSON.parse(rawIndex) as string;
      } catch {
        index = rawIndex;
      }
    } else {
      const num = parseInt(rawIndex, 10);
      index = isNaN(num) ? rawIndex : num;
    }
  }

  const indexStr =
    index !== undefined ? (typeof index === "number" ? `[${index}]` : `[${JSON.stringify(index)}]`) : "";
  const baseCanonical = `${isData ? "data." : ""}${resourceType}.${resourceName}${indexStr}`;
  const canonicalAddress = moduleAddress ? `${moduleAddress}.${baseCanonical}` : baseCanonical;

  return {
    raw: address,
    moduleAddress,
    mode: isData ? "data" : "managed",
    resourceType,
    resourceName,
    index,
    canonicalAddress,
  };
}

/**
 * Normalizes a resource address to standard representation.
 */
export function normalizeResourceAddress(address: string): string {
  return parseResourceAddress(address).canonicalAddress;
}

export function splitAddressSegments(address: string): string[] {
  // Tokenize dots only outside quoted instance keys and brackets.
  const tokens: string[] = [];
  let token = "",
    depth = 0,
    quoted = false,
    escaped = false;
  for (const ch of address) {
    if (escaped) {
      token += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\" && quoted) {
      token += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') quoted = !quoted;
    if (!quoted) {
      if (ch === "[") depth++;
      if (ch === "]") depth--;
      if (ch === "." && depth === 0) {
        tokens.push(token);
        token = "";
        continue;
      }
    }
    token += ch;
  }
  tokens.push(token);
  return tokens;
}

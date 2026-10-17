import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface DrawioValidationResult {
  isValid: boolean;
  pageCount: number;
  totalObjects: number;
  hasEmbeddedImage: boolean;
  containsSecretLeak: boolean;
  errors: string[];
}

const FORBIDDEN_SECRETS = ["TEST_SECRET_DO_NOT_EXPORT_12345", "TOKEN_SECRET_DO_NOT_EXPORT_67890"];

/**
 * Validates that an XML string is a compliant, native, editable diagrams.net document
 * and checks for security leaks or dummy image embedding.
 */
export function validateDrawioXml(xmlString: string): DrawioValidationResult {
  const errors: string[] = [];
  if (/<!DOCTYPE|<!ENTITY/i.test(xmlString)) {
    return {
      isValid: false,
      pageCount: 0,
      totalObjects: 0,
      hasEmbeddedImage: false,
      containsSecretLeak: false,
      errors: ["External declarations and entity definitions are forbidden."],
    };
  }

  // 1. Fast XML Syntax validation
  const validationResult = XMLValidator.validate(xmlString);
  if (validationResult !== true) {
    errors.push(`XML Syntax Error: ${validationResult.err.msg} at line ${validationResult.err.line}`);
    return {
      isValid: false,
      pageCount: 0,
      totalObjects: 0,
      hasEmbeddedImage: false,
      containsSecretLeak: false,
      errors,
    };
  }

  // 2. Secret leak check
  let containsSecretLeak = false;
  for (const secret of FORBIDDEN_SECRETS) {
    if (xmlString.includes(secret)) {
      containsSecretLeak = true;
      errors.push(`SECURITY VIOLATION: Secret pattern '${secret}' detected inside XML!`);
    }
  }

  // 3. Embedded image check (reject faked drawio embedding base64 images)
  const hasEmbeddedImage =
    xmlString.includes("data:image/png;base64") || xmlString.includes("data:image/svg+xml");
  if (hasEmbeddedImage) {
    errors.push(
      "VALIDATION ERROR: Document contains embedded base64 raster/SVG image instead of native editable objects.",
    );
  }

  // 4. Parse structure
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
    attributeNamePrefix: "@_",
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xmlString);
  } catch (err: unknown) {
    errors.push(`Parser Error: ${(err as Error).message}`);
    return {
      isValid: false,
      pageCount: 0,
      totalObjects: 0,
      hasEmbeddedImage,
      containsSecretLeak,
      errors,
    };
  }

  const mxfile = parsed["mxfile"] as Record<string, unknown> | undefined;
  if (!mxfile) {
    errors.push("Missing <mxfile> root element.");
    return {
      isValid: false,
      pageCount: 0,
      totalObjects: 0,
      hasEmbeddedImage,
      containsSecretLeak,
      errors,
    };
  }

  const rawDiagram = mxfile["diagram"];
  const diagrams = Array.isArray(rawDiagram) ? rawDiagram : rawDiagram ? [rawDiagram] : [];
  if (diagrams.length === 0) {
    errors.push("Document contains no <diagram> pages.");
  }

  let totalObjects = 0;
  for (const d of diagrams) {
    const dObj = d as Record<string, unknown>;
    const model = dObj["mxGraphModel"] as Record<string, unknown> | undefined;
    if (!model) {
      errors.push("Diagram is missing <mxGraphModel> element.");
      continue;
    }
    const root = model["root"] as Record<string, unknown> | undefined;
    if (!root) {
      errors.push("Graph model is missing <root> element.");
      continue;
    }

    const objects = root["object"];
    const array = (v: unknown): Array<Record<string, unknown>> =>
      (Array.isArray(v) ? v : v ? [v] : []) as Array<Record<string, unknown>>;
    const all = [...array(root.mxCell), ...array(objects)];
    const ids = new Set(all.map((n) => String(n["@_id"])));
    if (ids.size !== all.length) errors.push("Duplicate object IDs in diagram page.");
    for (const item of all) {
      const cell = (item.mxCell ?? item) as Record<string, unknown>;
      for (const key of ["@_parent", "@_source", "@_target"])
        if (cell[key] !== undefined && !ids.has(String(cell[key])))
          errors.push("Dangling diagram object reference.");
    }
    if (Array.isArray(objects)) {
      totalObjects += objects.length;
    } else if (objects) {
      totalObjects += 1;
    }
  }

  return {
    isValid: errors.length === 0,
    pageCount: diagrams.length,
    totalObjects,
    hasEmbeddedImage,
    containsSecretLeak,
    errors,
  };
}

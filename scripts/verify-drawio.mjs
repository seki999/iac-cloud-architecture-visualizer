import { readFileSync, readdirSync } from "node:fs";
import { XMLValidator, XMLParser } from "fast-xml-parser";
const paths = process.argv.slice(2);
if (!paths.length)
  paths.push(
    ...readdirSync("examples")
      .filter((n) => n.endsWith(".drawio"))
      .map((n) => `examples/${n}`),
  );
for (const path of paths) {
  const xml = readFileSync(path, "utf8");
  if (XMLValidator.validate(xml) !== true) throw new Error(`Invalid XML: ${path}`);
  if (/<!DOCTYPE|<!ENTITY|TEST_SECRET_DO_NOT_EXPORT_12345|data:image/i.test(xml))
    throw new Error(`Unsafe output: ${path}`);
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(xml);
  const pages = Array.isArray(parsed.mxfile.diagram) ? parsed.mxfile.diagram : [parsed.mxfile.diagram];
  for (const page of pages) {
    const root = page.mxGraphModel.root;
    const all = [
      ...(Array.isArray(root.mxCell) ? root.mxCell : [root.mxCell]),
      ...(Array.isArray(root.object) ? root.object : root.object ? [root.object] : []),
    ];
    const ids = new Set(all.map((n) => String(n["@_id"])));
    if (ids.size !== all.length) throw new Error(`Duplicate IDs: ${path}`);
    for (const n of all) {
      const cell = n.mxCell ?? n;
      for (const key of ["@_parent", "@_source", "@_target"])
        if (cell[key] !== undefined && !ids.has(String(cell[key])))
          throw new Error(`Dangling ${key}: ${path}`);
    }
  }
  console.log(
    `${path}: ${pages.length} pages; XML and object references valid (UI editing requires manual acceptance)`,
  );
}

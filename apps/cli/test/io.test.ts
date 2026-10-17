import { it, expect, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, linkSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLocalFile, writeDiagramFile } from "../src/io.js";
const dir = mkdtempSync(join(tmpdir(), "iacviz-io-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
it("rejects a hard-link alias of the input without changing the input", () => {
  const source = join(dir, "source.json"),
    alias = join(dir, "alias.drawio");
  writeFileSync(source, "original input");
  linkSync(source, alias);
  expect(() => writeDiagramFile(alias, "replacement", [source])).toThrow("aliases");
  expect(readFileSync(source, "utf8")).toBe("original input");
});
it("writes and replaces outputs atomically, leaving no temporary files", () => {
  const target = join(dir, "nested", "output.drawio");
  writeDiagramFile(target, "one", []);
  writeDiagramFile(target, "two", []);
  expect(readFileSync(target, "utf8")).toBe("two");
  expect(readdirSync(join(dir, "nested"))).toEqual(["output.drawio"]);
});
it("rejects oversized input before reading its contents", () => {
  const path = join(dir, "size.json");
  writeFileSync(path, "TEST_SECRET_DO_NOT_EXPORT_12345");
  expect(() => readLocalFile(path, 4)).toThrow("size limit");
});
it("accepts UTF-8 BOM and rejects directories", () => {
  const path = join(dir, "bom.json");
  writeFileSync(path, "\uFEFF{}");
  expect(readLocalFile(path)).toBe("{}");
  expect(() => readLocalFile(dir)).toThrow("regular");
});

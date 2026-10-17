import { it, expect, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "iacviz-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
function cli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", "apps/cli/src/index.ts", ...args], {
    encoding: "utf8",
  });
}
it("generates both pages through CLI in a path containing spaces", () => {
  const output = join(dir, "architecture output.drawio");
  const result = cli([
    "generate",
    "--input",
    "fixtures/dataset-02-three-tier/plan.json",
    "--view",
    "all",
    "--output",
    output,
  ]);
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(output, "utf8")).toContain('name="Network"');
});
it.each(["inspect", "validate"])("%s processes sensitive sample without logging secret", (command) => {
  const r = cli([command, "--input", "fixtures/dataset-05-sensitive/plan.json"]);
  expect(r.status, r.stderr).toBe(0);
  expect(r.stdout + r.stderr).not.toContain("TEST_SECRET_DO_NOT_EXPORT_12345");
});
it.each([
  { args: ["--view", "typo"] },
  { args: ["--direction", "typo"] },
  { args: ["--config", "missing-config.json"] },
])("rejects invalid options $args", ({ args }) => {
  const r = cli([
    "generate",
    "--input",
    "fixtures/dataset-01-network/plan.json",
    ...args,
    "--output",
    join(dir, "invalid.drawio"),
  ]);
  expect(r.status).not.toBe(0);
  expect(existsSync(join(dir, "invalid.drawio"))).toBe(false);
});
it("does not leak malformed input fragments in diagnostics", () => {
  const path = join(dir, "bad.json");
  writeFileSync(path, '{"TEST_SECRET_DO_NOT_EXPORT_12345":');
  const r = cli(["validate", "--input", path]);
  expect(r.status).not.toBe(0);
  expect(r.stderr + r.stdout).not.toContain("TEST_SECRET");
});
it("rejects schema-invalid config without printing its values", () => {
  const path = join(dir, "config.json");
  writeFileSync(path, JSON.stringify({ schemaVersion: "TEST_SECRET_DO_NOT_EXPORT_12345" }));
  const r = cli(["generate", "--input", "fixtures/dataset-01-network/plan.json", "--config", path]);
  expect(r.status).not.toBe(0);
  expect(r.stderr).not.toContain("TEST_SECRET");
});

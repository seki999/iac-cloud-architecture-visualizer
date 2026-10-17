#!/usr/bin/env node
/**
 * Developer-only helper that regenerates Golden Fixture JSON from the
 * Terraform configurations under fixtures/.
 *
 * SAFETY RULES (enforced by this script):
 *   - AWS datasets are only ever PLANNED (`terraform plan -refresh=false`).
 *     `terraform apply` is NEVER run against AWS configurations.
 *   - The AWS provider is configured with dummy credentials and skip_* flags,
 *     and the configurations contain no data sources, so no AWS API is called.
 *   - Replacement samples are retained without running apply.
 *
 * The iacviz tool itself never executes Terraform; this script exists only to
 * produce reproducible test inputs. Requires Terraform CLI on PATH.
 *
 * Usage: node scripts/generate-terraform-fixtures.mjs [dataset-dir-name ...]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const fixtures = join(root, "fixtures");
const pluginCache = join(root, ".tf-plugin-cache");
mkdirSync(pluginCache, { recursive: true });

const env = {
  ...process.env,
  TF_PLUGIN_CACHE_DIR: pluginCache,
  CHECKPOINT_DISABLE: "1",
  TF_IN_AUTOMATION: "1",
};

function tf(cwd, args, { capture = false } = {}) {
  const r = spawnSync("terraform", args, { cwd, env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error(`terraform ${args[0]} failed in ${cwd}:\n${r.stderr || r.stdout}`);
  }
  return capture ? r.stdout : "";
}

function normalizeJson(text) {
  // Pretty-print for reviewable diffs; strip the volatile timestamp.
  const obj = JSON.parse(text);
  if ("timestamp" in obj) obj.timestamp = "2026-01-01T00:00:00Z";
  return JSON.stringify(obj, null, 2) + "\n";
}

const PLAN_ONLY = [
  "dataset-01-network",
  "dataset-02-three-tier",
  "dataset-03-unknown",
  "dataset-05-sensitive",
  "dataset-06-modules",
  "dataset-07-multi-subnet",
];

function planDataset(name) {
  const dir = join(fixtures, name);
  console.log(`[plan] ${name}`);
  tf(dir, ["init", "-input=false", "-no-color"]);
  tf(dir, ["plan", "-input=false", "-no-color", "-refresh=false", "-lock=false", "-out=plan.tfplan"]);
  const json = tf(dir, ["show", "-json", "plan.tfplan"], { capture: true });
  writeFileSync(join(dir, "plan.json"), normalizeJson(json));
  rmSync(join(dir, "plan.tfplan"), { force: true });
}

// Replacement fixtures are retained; this script never runs apply.
const wanted = process.argv.slice(2);
const run = (n) => wanted.length === 0 || wanted.includes(n);
for (const n of PLAN_ONLY) if (run(n) && existsSync(join(fixtures, n, "main.tf"))) planDataset(n);

// Record provenance next to each generated file.
const version = JSON.parse(tf(root, ["version", "-json"], { capture: true })).terraform_version;
for (const n of PLAN_ONLY) {
  const p = join(fixtures, n, "plan.json");
  if (!existsSync(p) || !run(n)) continue;
  const prov = join(fixtures, n, "PROVENANCE.json");
  const prev = existsSync(prov) ? JSON.parse(readFileSync(prov, "utf8")) : {};
  prev["plan.json"] = {
    origin: "real-terraform-cli",
    terraformVersion: version,
    command: "terraform show -json <planfile>",
  };

  writeFileSync(prov, JSON.stringify(prev, null, 2) + "\n");
}
console.log("done");

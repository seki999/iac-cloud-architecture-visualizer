import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { cpus, platform, totalmem } from "node:os";
mkdirSync("out", { recursive: true });
const results = [];
const base = JSON.parse(readFileSync("fixtures/dataset-08-large/state.json", "utf8"));
for (const size of [50, 500]) {
  const copy = JSON.parse(JSON.stringify(base));
  copy.values.root_module.resources = copy.values.root_module.resources.slice(0, size);
  while (copy.values.root_module.resources.length < size) {
    const i = copy.values.root_module.resources.length;
    copy.values.root_module.resources.push({
      address: `aws_s3_bucket.scale_${i}`,
      type: "aws_s3_bucket",
      name: `scale_${i}`,
      provider_name: "registry.terraform.io/hashicorp/aws",
      values: { id: `scale-bucket-${i}`, bucket: `scale-bucket-${i}` },
    });
  }
  writeFileSync(`out/benchmark-${size}.json`, JSON.stringify(copy));
}
for (const input of [
  "fixtures/dataset-01-network/plan.json",
  "out/benchmark-50.json",
  "fixtures/dataset-08-large/state.json",
  "out/benchmark-500.json",
]) {
  const start = performance.now();
  const result = spawnSync(
    process.execPath,
    [
      "apps/cli/dist/index.js",
      "generate",
      "--input",
      input,
      "--view",
      "all",
      "--output",
      "out/benchmark.drawio",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  const json = JSON.parse(readFileSync(input, "utf8"));
  const count = (m) =>
    (m?.resources?.length ?? 0) + (m?.child_modules ?? []).reduce((a, c) => a + count(c), 0);
  results.push({
    input,
    resources: json.resource_changes?.length ?? count(json.values?.root_module),
    milliseconds: Math.round(performance.now() - start),
    fallback: result.stderr.includes("fallback"),
  });
}
const report = {
  node: process.version,
  platform: platform(),
  cpu: cpus()[0]?.model,
  memoryGiB: Math.round(totalmem() / 1024 ** 3),
  measuredAt: new Date().toISOString(),
  method:
    "One cold CLI process per input; both views; includes parsing, layout and XML write. Not a statistical benchmark.",
  results,
};
writeFileSync("docs/performance-results.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));

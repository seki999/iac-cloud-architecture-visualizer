import { spawnSync } from "node:child_process";
import { readdirSync, mkdirSync } from "node:fs";
mkdirSync("examples", { recursive: true });
for (const folder of readdirSync("fixtures").filter((n) => n.startsWith("dataset-"))) {
  const run = spawnSync(
    process.execPath,
    [
      "apps/cli/dist/index.js",
      "generate",
      "--input",
      `fixtures/${folder}/plan.json`,
      "--view",
      "all",
      "--output",
      `examples/${folder}.drawio`,
    ],
    { encoding: "utf8" },
  );
  if (run.status !== 0) throw new Error(run.stderr || "Example generation failed");
  console.log(`${folder}: generated Overview + Network`);
}

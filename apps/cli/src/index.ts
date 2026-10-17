#!/usr/bin/env node
import { Command, Option } from "commander";
import { readLocalFile, writeDiagramFile } from "./io.js";
import { parseTerraformJson } from "@iacviz/terraform-adapter";
import { inspectGraph, formatGraphSummary } from "@iacviz/core";
import { buildViewModel } from "@iacviz/architecture-intelligence";
import { layoutViewModel } from "@iacviz/layout";
import { renderDrawioXml, validateDrawioXml } from "@iacviz/renderer-drawio";
import { DiagramConfigSchema } from "@iacviz/schemas";
import type { DiagramConfig } from "@iacviz/schemas";

import { extractAwsRelationships, AWS_RESOURCE_RULES } from "@iacviz/providers-aws";

const program = new Command()
  .name("iacviz")
  .description("Offline Terraform/OpenTofu JSON to editable draw.io architecture diagrams")
  .version("0.1.0");
function graph(path: string) {
  const parsed = parseTerraformJson(readLocalFile(path));
  return { ...parsed, edges: [...parsed.edges, ...extractAwsRelationships(parsed)] };
}
function fail(error: unknown) {
  // Schema and JSON errors may include user values; never print their raw messages.
  const message = error instanceof Error ? error.message : "";
  const safe = /^(Invalid |Unsupported |Unrecognized |Cannot read |Generated XML failed)/.test(message)
    ? message
    : "Operation failed. Check the input, configuration and output path.";
  console.error(safe);
  process.exitCode = 1;
}
program
  .command("generate")
  .requiredOption("-i, --input <path>", "terraform/tofu show -json file")
  .addOption(
    new Option("-v, --view <type>", "overview | network | all").choices(["overview", "network", "all"]),
  )
  .option("-o, --output <path>", "Output .drawio file", "architecture.drawio")
  .option("-c, --config <path>", "diagram.json settings")
  .addOption(
    new Option("-d, --direction <dir>", "Layout direction").choices(["LEFT_TO_RIGHT", "TOP_TO_BOTTOM"]),
  )
  .action(async (opts) => {
    try {
      const infra = graph(opts.input);
      let config: DiagramConfig | undefined;
      if (opts.config) {
        let raw: unknown;
        try {
          raw = JSON.parse(readLocalFile(opts.config, 1024 * 1024));
        } catch {
          throw new Error("Invalid diagram config JSON.");
        }
        const parsed = DiagramConfigSchema.safeParse(raw);
        if (!parsed.success) throw new Error("Invalid diagram config schema.");
        config = parsed.data;
        if (
          config.annotations.length ||
          Object.keys(config.manualPositions).length ||
          config.collapsedGroups.length
        )
          console.warn(
            "Warning: annotations, manual positions and collapsed groups are reserved settings and are not applied yet.",
          );
      }
      const requested = opts.view ?? config?.view ?? "overview";
      const types: Array<"overview" | "network"> =
        requested === "all" ? ["overview", "network"] : [requested];
      const views = [];
      for (const view of types)
        views.push(
          await layoutViewModel(buildViewModel(infra, { view, config }), {
            direction: opts.direction ?? config?.layout.direction,
            nodeSpacing: config?.layout.nodeSpacing,
            layerSpacing: config?.layout.spacing,
          }),
        );
      const xml = renderDrawioXml(views);
      if (!validateDrawioXml(xml).isValid)
        throw new Error("Generated XML failed validation; no file written.");
      const output = writeDiagramFile(opts.output, xml, [opts.input, ...(opts.config ? [opts.config] : [])]);
      console.log(`Generated ${views.length} editable page(s): ${output}`);
      for (const warning of new Set(views.flatMap((v) => v.warnings))) console.warn(`Warning: ${warning}`);
    } catch (error) {
      fail(error);
    }
  });
program
  .command("inspect")
  .requiredOption("-i, --input <path>", "Input JSON file")
  .action((opts) => {
    try {
      console.log(
        formatGraphSummary(inspectGraph(graph(opts.input), new Set(Object.keys(AWS_RESOURCE_RULES)))),
      );
    } catch (error) {
      fail(error);
    }
  });
program
  .command("validate")
  .requiredOption("-i, --input <path>", "Input JSON file")
  .action((opts) => {
    try {
      const g = graph(opts.input);
      console.log(`Valid ${g.source.kind} JSON; ${g.nodes.length} resources; engine: ${g.source.engine}`);
    } catch (error) {
      fail(error);
    }
  });
await program.parseAsync(process.argv);

# CLI reference

pnpm iacviz generate --input FILE [--view overview|network|all] [--output FILE.drawio] [--config diagram.json] [--direction LEFT_TO_RIGHT|TOP_TO_BOTTOM]

Defaults: overview, architecture.drawio, LEFT_TO_RIGHT. Config view/direction apply when not overridden. Config includes positive spacing, hidden addresses and future reserved display settings. Nonempty unsupported settings produce warnings. Parent output directories are created. Output must differ from input/config paths.

pnpm iacviz validate --input FILE validates the parsed resource schema and prints a safe count. pnpm iacviz inspect --input FILE prints resource/provider/type/knowledge counts, never complete raw properties. CLI failures return a nonzero status. pnpm dev accepts the same commands through tsx from the repository root.

Use UTF-8. For PowerShell 5.1 use Set-Content -Encoding UTF8; BOM is accepted. Quote paths containing spaces. No AWS CLI or Terraform executable is required for processing existing JSON. See the three README files for complete commands.

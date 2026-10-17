# IaC Cloud Architecture Visualizer

Convert Terraform/OpenTofu **`show -json`** state or plan representations into native, editable diagrams.net files. Processing runs locally: the CLI does not execute Terraform, call AWS APIs, or upload your input.

[中文](README.zh-CN.md) · [日本語](README.ja.md)

## Quick start

Use Node.js 22 or 24 and pnpm 9.15.9. No Python, AWS CLI, AWS credentials or Terraform installation is required for existing JSON inputs.

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
pnpm iacviz generate --input fixtures/dataset-01-network/plan.json --view all --output out/architecture.drawio
pnpm iacviz inspect --input fixtures/dataset-01-network/plan.json
pnpm iacviz validate --input fixtures/dataset-01-network/plan.json
```

Open the generated file in diagrams.net using **File → Open From → Device**. Overview and Network are separate pages. Resource shapes, containers, text and attached edges are editable; node data includes the resource address and safe metadata. AWS services are drawn with diagrams.net aws4 icons on labelled cards; VPC and subnet frames use the AWS group style, and the Network page groups subnets into AZ columns when the subnet AZ is recorded. All nine examples were opened and checked in app.diagrams.net (pages, attached edges, editable/movable cells, metadata after save); see [draw.io export and acceptance](docs/drawio-export.md). Print legibility on A4/A3 remains a manual review.

```powershell
pnpm dev generate --input fixtures/dataset-02-three-tier/plan.json --view overview --output out/overview.drawio
pnpm iacviz generate --input fixtures/dataset-07-multi-subnet/plan.json --view network --direction TOP_TO_BOTTOM --output out/network.drawio
pnpm examples
pnpm verify:drawio
pnpm bench
```

Quote paths containing spaces. These commands also work in Linux/macOS shells.

## Input and interpretation

For an existing state or saved plan, explicitly export JSON yourself:

```powershell
terraform show -json saved.tfstate > state.json
terraform show -json saved.tfplan > plan.json
# Or: tofu show -json saved.tfplan > plan.json
```

PowerShell 7 writes UTF-8 by default. In Windows PowerShell 5.1 use `terraform show -json saved.tfplan | Set-Content -Encoding UTF8 plan.json`. The reader accepts a UTF-8 BOM. Raw `.tfstate` JSON is a different format and is rejected. Format version 1.x is supported; unknown major versions are rejected. Engine identity defaults to `unknown` because the shared JSON structure does not reliably distinguish Terraform from OpenTofu. The OpenTofu library adapter explicitly identifies its caller.

State is recorded infrastructure and may be stale. Plan is proposed infrastructure and often has unknown IDs. References and explicit `depends_on` are IaC facts, not proof of network traffic. Ambiguous references remain unresolved and produce warnings. Replacement action order is retained. The CLI never applies a plan.

## Views and configuration

Overview hides selected low-level details while retaining them in InfraGraph. Network includes routing and security details. Multi-subnet resources use a common proven VPC when available; unresolved placement stays at the root. S3 and IAM are not forced into subnets. No ECS-to-RDS business flow is guessed.

```json
{
  "schemaVersion": "1.0",
  "view": "network",
  "layout": { "direction": "LEFT_TO_RIGHT", "spacing": 40, "nodeSpacing": 40 },
  "hiddenResourceAddresses": [],
  "collapsedGroups": [],
  "manualPositions": {},
  "annotations": []
}
```

Pass `--config diagram.json`. Explicit CLI view/direction overrides config. Hidden addresses and spacing are applied. Collapsed groups, annotations and manual positions are reserved; nonempty values produce a warning. They are not a graphical editor.

## Safety and limits

Only allowlisted architectural attributes enter the model. Sensitivity masks and additional test-secret detection are applied, with conservative removal of nested sensitive fields. Outputs/configuration constants are not copied. Labels are plain text; XML is generated with `fast-xml-parser`'s builder. Unmarked secrets cannot all be recognized: review inputs and outputs before sharing. JSON exports from Terraform can contain plaintext secrets; protect them at rest.

The current implementation is a working MVP baseline with explicit remaining acceptance items: broader aggregation, advanced route inference, historical/deposed objects and full manual-position support are incomplete. Unknown resources remain generic. AWS icons use stencil names verified in app.diagrams.net on 2026-10-17; older or offline diagrams.net builds were not tested (cards stay readable without the icon). Large diagrams may require several pages when printed. See [limitations](docs/limitations.md), [development report](docs/development-report.md), [security](docs/security.md) and [measured performance](docs/performance-results.json).

## Development

The workspace separates schemas, graph core, Terraform/OpenTofu adapters, AWS semantic rules, view intelligence, ELK layout and XML rendering. Add provider rules without modifying the renderer. See [architecture](docs/architecture.md), [AWS rules](docs/aws-rules.md), [testing](docs/testing.md) and [roadmap](docs/roadmap.md). Tests use all nine fixture groups, including a deterministic 200-resource synthetic sample. Original fixture provenance is recorded per dataset; inherited CLI provenance has not been independently regenerated in this development continuation.

CI is configured for Windows, Linux and macOS on Node 22/24. Local verification does not prove remote CI execution. The source is intended for Apache-2.0 distribution; see LICENSE.

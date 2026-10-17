# Draw.io export and acceptance

XMLBuilder generates uncompressed mxfile/diagram/mxGraphModel/root documents. Nodes and edges use object wrappers with mxCell children. Node geometry is local to the visual parent; root geometry is offset below the title. Edge geometry stays at root with absolute bend points. All labels use html=0 to prevent HTML/image payload execution. Metadata records addresses, types, providers, safe attributes, knowledge, evidence and semantic scope.

## Shapes, icons and containers

- **Resource cards** are native rounded rectangles with the label (name, subtitle) and the AWS category colour. Inferred/unknown resources use a dashed border.
- **AWS icons** come from `AwsIconRegistry` (`packages/providers-aws/src/icons.ts`). Each icon is a separate, decorative child cell (`decorative="aws-icon"`, `connectable=0`) of its card, so it moves with the card and carries no resource data. Only aws4 stencil names confirmed in the app.diagrams.net stencil registry on 2026-10-17 are listed; unknown icon keys produce a plain card without an icon. If an older or offline diagrams.net build lacks a stencil, the card and its label remain readable.
- **Containers** use the diagrams.net AWS group shape (`mxgraph.aws4.group`): VPC (`group_vpc2`), public subnet (green), private subnet (teal), unknown-class subnet (grey, dashed). The subnet class comes from route evidence (see aws-rules.md), never from names.
- **AZ frames** (Network view only) group subnets by their recorded `availability_zone` attribute. They are synthetic visual containers (`resource_type="iacviz_availability_zone"`, empty `terraform_address`, `synthetic: true` in metadata) and never represent a Terraform resource. Subnets with an unknown AZ stay directly in the VPC.
- IaC-only `references`/`depends_on` edges are not drawn; they remain in the graph model and in `inspect`.

No external images or scripts are embedded. [AWS icon usage](https://aws.amazon.com/architecture/icons/) rules apply when distributing diagrams that render the AWS stencils.

## Layout

Each VPC that has AZ frames is arranged first: VPC-level resources form a band at the top; AZ frames sit side by side below it, and subnets of the same routing class share a row across AZs. ELK lays out subnet contents, the band and the root level. Edges that end inside such a VPC get no ELK bend points; diagrams.net routes them orthogonally between the attached terminals. Other containers use ELK's hierarchical layered layout.

## Automated checks

`pnpm examples` regenerates `examples/*.drawio`; `pnpm verify:drawio` checks XML validity, unique IDs, parent/source/target references, pages and forbidden test-secret patterns. Unit tests cover icon cell parenting, verified stencil naming, AZ grouping, AZ-column alignment and layout determinism. XML validation alone is not UI validation.

## diagrams.net acceptance (performed 2026-10-17)

Environment: app.diagrams.net (online, current on 2026-10-17) in the Claude desktop app's embedded Chromium browser, Windows 11.

Procedure (repeatable):

1. `node scripts/drawio-acceptance/serve.mjs examples` (listens on 127.0.0.1 only).
2. Open `http://127.0.0.1:43828/open?file=<name>.drawio`. It redirects to app.diagrams.net with the file encoded in the `#R` URL hash (diagrams.net's own format). The diagram content therefore goes into the URL loaded by app.diagrams.net; do not use this for diagrams that must not be opened there. **File → Open From → Device** is the equivalent manual route.
3. Paste `scripts/drawio-acceptance/in-app-check.js` into the devtools console, click another page tab once, then run `iacvizCheck()`.

Results for all nine examples (Overview and Network pages):

| Check | Result |
|---|---|
| File opens with both pages | Passed, 9/9 |
| Dangling edges (missing source/target) | 0 on every page |
| Resource cells carrying `terraform_address` | All resource cells; only AZ frames are address-less |
| Unresolved shapes/stencils | None |
| Locked (non-movable / non-editable) cells | 0 |
| Embedded image cells | 0 |
| Overlapping sibling resource cards | 0 |
| Save through diagrams.net (`getFileData`) keeps both pages and metadata | Passed, 9/9 |
| Dataset 05 test-secret marker after diagrams.net save | Absent |
| Real mouse drag of a resource card (dataset 02) | Card moved; icon child followed |
| Moving a VPC container (dataset 02) | All 16 descendants followed; edges stayed attached |
| Label edit with Japanese/Chinese text (dataset 02) | Label changed; `terraform_address` kept |

Still manual:

- Printing/exporting A4/A3 landscape PDF and judging legibility in a design document.
- Visual review of crowded labels in the 200-resource sample.
- Desktop (drawio-desktop) and offline builds were not tested.

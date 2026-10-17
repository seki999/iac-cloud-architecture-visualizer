# Development result report — 2026-10-17

## Continuation 2 (latest)

Starting state: build passed, but 8 tests failed (graph snapshots predated the unknown collection-reference edges) and Prettier failed on 21 files. Both were restored first, then:

- **Real diagrams.net acceptance.** All nine examples were opened in app.diagrams.net and checked inside the live editor with `scripts/drawio-acceptance/` (procedure and results in drawio-export.md). Results: both pages load, 0 dangling edges, 0 locked cells, 0 image cells, 0 overlapping sibling cards, every stencil resolves, save keeps both pages and metadata, and the dataset 05 secret marker is absent after saving. A real mouse drag, a VPC container move (16 descendants followed) and a Japanese/Chinese label edit were exercised.
- **AWS icons.** `AwsIconRegistry` now maps to aws4 stencils confirmed in diagrams.net's stencil registry. Icons are decorative, non-connectable child cells of labelled cards. VPC and subnet frames use the AWS group style; subnet colour follows the route-derived class.
- **Network view AZ frames + AZ-column layout.** Subnets are grouped by their recorded `availability_zone` into synthetic visual frames. AZ frames sit side by side, and subnets of the same routing class share a row. dataset-02's VPC went from 695×2310 to a landscape layout.
- **Plan semantics (all real-CLI plans were affected).** Previously every subnet in plan-only datasets was classified `unknown` and `subnet_id = aws_subnet.x[0].id` resources were not placed. Fixes:
  - Terraform's containing-object references (`x.y[0]`, `x.y`) no longer create spurious ambiguity.
  - Route tables are deduced, as `inferred`, from association blocks that cover a subnet collection one-to-one with a single table.
  - Explicit `ipv6_cidr_block = null` lets the overall class follow IPv4.
  - Unresolved var/local/each.value references are recorded in `unresolvedReferencePaths`.
  - count.index-referenced resources are placed at their common VPC.
  - dataset-01 now shows public/private-nat-egress subnets with the bastion and NAT inside public[0].
- **IaC-only edges** (`references`, `depends_on`) are no longer drawn in Network either; they stay in the graph.
- **Regression found and fixed.** An ELK option added during this work (`considerModelOrder`) crashed ELK's hierarchical layout for every Overview, which silently used the grid fallback. A new test now fails if any dataset/view falls back.

Verification (Windows 11, Node v24.20.0): `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm lint` passed; `pnpm test` 94/94 across 9 files; `pnpm examples` + `pnpm verify:drawio` 9/9.

Golden changes: the relation diff is in golden-relation-changes.json. This run removed only spurious containing-object `references` (unknown) edges in datasets 01/02. Graph snapshots gained `ipv6_cidr_block: null` and `unresolvedReferencePaths`; no other change was found.

Performance (one cold CLI process, both views, single sample):

| Resources | Elapsed | ELK fallback |
|---:|---:|---|
| 22 | 509 ms | No |
| 50 | 726 ms | No |
| 200 | 1202 ms | No |
| 500 | 1311 ms | No |

Still outstanding (unchanged unless noted):
- A4/A3 print legibility review.
- drawio-desktop/offline builds.
- Independent golden review.
- Deployable HCL for datasets 08/09.
- ECS/Multi-AZ aggregation.
- Advanced routing.
- Manual positions and annotations.
- GitHub CI and Linux/macOS runs.

No commit, push, Terraform run or AWS access occurred.

## Continuation 1

This continuation upgraded the existing partial implementation into a runnable, tested CLI baseline. The complete original MVP Definition of Done is **not yet satisfied**. Remaining acceptance work is listed below and in limitations.md.

## Implemented and repaired

- Fixed ELK imports/types and bundled workspace dependencies so the built CLI runs directly with Node. Development commands now resolve user paths from the repository root.
- Replaced punctuation-based node IDs with deterministic SHA-256 IDs; parsed quoted instance keys and module paths; separated current/deposed identities.
- Parsed planned_values even without resource_changes. Preserved ordered replacement actions and configuration evidence. Resolved references only to actual nodes; ambiguous instance bindings remain unresolved with warnings.
- Added explicit routing/nested attribute allowlists, conservative nested sensitivity filtering, safe diagnostic messages and XML control-character filtering. Raw output/configuration values are not exported.
- Replaced hand-built XML with XMLBuilder and disabled HTML labels. Native nodes, containers, edges, metadata, title and relationship legend are generated. Inferred/unknown edges use dashed styles.
- Added typed AWS value bindings, listener/ECS target relationships, route-table classification and safe generic fallbacks. Multi-subnet placement uses common evidence; hidden visual containers reparent children.
- Fixed container sizing by letting ELK enforce minimum sizes before layout. Tests check sibling collision and container bounds on four datasets. Ancestor relations remain in the view but are excluded from ELK routing to avoid invalid hierarchy edges.
- Added explicit same-subnet ASG EC2 aggregation in Overview; Network keeps individual nodes. Aggregation preserves member addresses and edge evidence.
- Added strict CLI choices/config parsing, prevention of input/config overwrite, positive layout spacing, safe summaries, example generation, XML verification and performance scripts.
- Added English/Chinese/Japanese README files, architecture/security/development/test documentation, Apache-2.0 license, nine dataset baselines and a six-platform/version CI matrix configuration.

## Executed verification

Host: Windows, Node v24.20.0, Intel Core i7-12650H, 32 GiB RAM.

| Check | Result |
|---|---|
| pnpm install --frozen-lockfile | Passed |
| pnpm typecheck | Passed |
| pnpm build | Passed, runnable ESM CLI bundle |
| pnpm test | Passed, 49 tests across 4 files |
| pnpm lint | Passed, ESLint and Prettier |
| pnpm examples | Passed, 9 datasets × Overview/Network |
| pnpm verify:drawio | Passed, XML/IDs/parent and terminal references |
| CLI inspect and validate | Passed in direct CLI tests |
| Test-secret leakage | Supplied marker absent from graph/export and tested CLI logs |
| Layout geometry | Four representative Network datasets have no tested sibling overlap or out-of-container child bounds |
| diagrams.net interactive editing | Not performed; manual acceptance pending |
| GitHub-hosted CI | Configuration added; remote execution not observed |
| Linux/macOS runtime checks | Not executed locally |
| Real Terraform/OpenTofu regeneration | Not executed in this continuation |

The test suite includes independent assertions and generated snapshots. All expected relation snapshots are compared, but their semantic content still requires independent review; they were generated from the implementation. Existing real-CLI provenance is inherited from previous work and has not been independently regenerated.

## End-to-end artifacts

The built CLI processed the supplied Terraform-format plans/states through parsing, graph construction, AWS rules, view building, ELK and XML generation. The nine examples/dataset-*.drawio files exist and contain two native pages each. XML checks confirm unique IDs and valid parent/source/target references. Example: examples/dataset-02-three-tier.drawio.

No AWS login, Terraform apply, infrastructure deployment or production input upload occurred. The optional fixture generator was changed to avoid its previous local apply path.

## Performance observations

One cold CLI process per dataset, generating **both** pages; includes parsing, layout and writing. Single samples, not statistical guarantees:

| Resources | Elapsed | ELK fallback |
|---|---:|---|
| 22 | 297 ms | No |
| 50 | 345 ms | No |
| 200 | 686 ms | No |
| 500 | 856 ms | No |

See performance-results.json for machine-readable data. The 50-resource sample truncates the deterministic 200-resource input; the 500-resource sample extends it with independent synthetic S3 resources. These are not representative of every 500-resource topology, and no portability or production performance guarantee is claimed.

## Outstanding acceptance and limitations

1. (Done in continuation 2 for app.diagrams.net; print A4/A3 and desktop/offline builds remain.)
2. Independently review expected graph/relations. Dataset 08/09 use synthetic JSON and provenance-only HCL notices; equivalent deployable HCL is incomplete.
3. Complete advanced routing, listener rules, module outputs, provider aliases and some nested multi-subnet placement semantics. The proposed 40-resource rule catalogue is not fully implemented.
4. Extend explicit-ASG aggregation to independently proven ECS/Multi-AZ ownership. Current service count labels are not synthetic task nodes.
5. Manual positions, collapsed groups, annotations and previous_address configuration migration remain reserved future behavior.
6. Historical/prior-state/drift/check rendering is partial. Deposed metadata is retained, but no dedicated historical view is provided.
7. (Continuation 2: aws4 icons verified on app.diagrams.net; older builds untested.)
8. Run actual CI on Windows/Linux/macOS and independently validate OpenTofu-produced datasets. Repeat performance measurements on varied topologies.
9. Unmarked secrets cannot all be detected. No comprehensive security audit is claimed.

These limitations are visible in README and docs/limitations.md. No remote commit, push, PR or deployment was created.

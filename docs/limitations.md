# Known limitations and outstanding acceptance

- diagrams.net structural/editing acceptance was performed on app.diagrams.net for all nine examples (drawio-export.md). A4/A3 print legibility, drawio-desktop and offline builds are not verified.
- Independent golden-relation review is pending. Generated baselines are regression snapshots, not semantic proof.
- Overview supports explicit same-subnet ASG EC2 aggregation; broader ECS/Multi-AZ merging remains incomplete. ASG/ECS counts and RDS Multi-AZ labels are supported.
- Not all 40 proposed AWS types have complete semantics. Missing rules use generic nodes with warnings.
- Main-route-table classification requires explicit evidence; AWS implicit defaults cannot be invented. Propagated routes, all hybrid target types, full subnet_mapping placement, module outputs, provider aliases, weighted listener rules and complex expressions require more work.
- Ambiguous count/for_each references remain unresolved instance bindings (kept as unknown references). Configuration references establish dependencies/bindings only, not application communication.
- Plan prior_state/drift/checks/output metadata are not a complete diff viewer. Deposed history is retained only partially and not presented as a historical view.
- Region/account grouping is not inferred without evidence. Some unresolved multi-subnet/RDS resources remain at root; no cloud API lookup fills missing facts.
- Manual positions, annotations and collapsed groups reserve schema only; address migration is not automated.
- AWS aws4 stencil names were verified on app.diagrams.net (2026-10-17) only. Icons are decorative children of labelled cards, so a missing stencil does not hide information.
- Plan subnets are classified through count/for_each association blocks only when the association block covers the subnet collection one-to-one with a single route table (marked inferred). Resources with count.index subnet references are placed at the VPC level, not in a subnet. Route tables whose `route` attribute is computed in the plan keep the subnet class unknown.
- AZ frames appear only in the Network view and only for subnets whose availability_zone is recorded. Edges into AZ-framed VPCs are routed by diagrams.net, not ELK.
- Dense labels and large printable layouts still require manual adjustment. A4/A3 page sizes do not guarantee a one-page readable export.
- Arbitrary unmarked secrets cannot all be recognized. The CLI enforces an input size limit, refuses symlink/hard-link destinations that alias inputs and writes atomically; no comprehensive security audit is claimed.
- Dataset 08/09 have synthetic JSON and provenance-only HCL notices, not equivalent deployable HCL. Existing CLI provenance was not rerun in this continuation.
- Local Windows verification is recorded; GitHub CI and Linux/macOS execution still require real runners. Library npm distribution is not packaged yet.

These items mean the entire requested Definition of Done is not yet satisfied.

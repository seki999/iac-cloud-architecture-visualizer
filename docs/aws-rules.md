# AWS semantic rules

Registry: packages/providers-aws/src/registry.ts. Extraction: relationships.ts. Classification: subnet-classifier.ts. Add a typed rule, whitelist only necessary fields, write independent evidence assertions and update documentation. New providers should get an independent semantic package; generic parsing must remain intact.

Current rules cover VPC/subnet membership, IGW/NAT attachment, EC2 subnet and security group binding, ALB subnet/security group association, simple listener forwarding, ECS target-group binding, RDS subnet groups and additional typed attribute references. Existing configuration bindings can remain inferred when cloud IDs are unknown. Explicit dependency edges stay depends_on. Unknown AWS types and unsupported providers render generic objects with warnings.

Routing classification uses explicit route-table associations and known main-route-table association resources. IPv4 and IPv6 are reported separately. Names never establish public/private state. Missing effective routing data remains unknown. IGW default routes suggest public routing, not public reachability; egress-only IPv6 is recorded as private-hybrid, never misrepresented as NAT. Advanced propagated route and module-output resolution are incomplete. Full listener-rule weighted forwarding and every provider nesting variation are not implemented.

### Plans with unknown IDs (count/for_each)

Terraform JSON records `subnet_id = aws_subnet.public[count.index].id` only as `["aws_subnet.public", "count.index"]`; the instance mapping is not provable. The parser keeps such collection references as `references` edges with knowledge `unknown` (never a binding). Two conservative deductions build on them:

- **Route-table association blocks**: a subnet's route table is deduced, with classification knowledge `inferred`, only when every association referencing exactly that subnet collection uses one route table and there are as many associations as subnets. AWS allows one explicit association per subnet, so an applicable plan associates every member with that table. Missing associations, mixed tables or other references leave the class `unknown`. Subnet subtitles show "(inferred)".
- **Placement**: a resource whose collection reference candidates all lie in one VPC is placed at that VPC, never in a guessed subnet. An unknown `subnet_id` that references exactly one subnet instance (e.g. `aws_subnet.public[0].id`) is placed in that subnet. Paths with `var`, `local` or `each.value` references that resolve to no resource are recorded in `unresolvedReferencePaths` and are never treated as complete.

Terraform also lists each containing object of a reference (`x.y[0].id`, `x.y[0]`, `x.y`); only the most specific one is resolved, so the containing collection does not create spurious ambiguity.

A subnet whose plan records `ipv6_cidr_block = null` has no IPv6 routing to consider; its overall class then follows IPv4. If the IPv6 CIDR is unknown or not recorded, an unknown IPv6 class keeps the overall class unknown.

### Icons

`AwsIconRegistry` (icons.ts) maps rule icon keys to aws4 stencils verified in diagrams.net; see drawio-export.md.

Typed ID lookups require an unambiguous resource and compatible type. A common VPC or similar name never proves application traffic.

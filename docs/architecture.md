# Architecture

Pipeline: JSON detector → state/plan adapter → InfraGraph → AWS evidence extraction → view selection and placement → ELK compound layout → native draw.io XML.

Schemas have no layout dependencies. Core owns identity and sanitization. Adapters interpret Terraform formats; OpenTofu reuses the shared representation with explicit engine identity. providers-aws contains service semantics, route classification and style registry. architecture-intelligence chooses visible resources and visual parents without changing graph facts. layout writes local container coordinates and root edge waypoints. renderer-drawio uses XMLBuilder to serialize editable objects.

Library packages currently expose TypeScript source for workspace development. The CLI bundles all workspace packages into runnable ESM and needs no TypeScript runtime after build. Source library packages are not yet packaged for independent npm distribution. No network or deployment operation occurs in the generation pipeline.

Canonical references: [Terraform JSON](https://developer.hashicorp.com/terraform/internals/json-format), [OpenTofu](https://opentofu.org/docs/), [ELKjs](https://github.com/kieler/elkjs), [ELK](https://eclipse.dev/elk/).

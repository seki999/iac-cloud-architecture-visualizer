# Testing and acceptance

Vitest covers malformed/versioned inputs, state/plan values, nested modules, quoted keys, stable IDs, replacement ordering, sensitive nested tags/arrays, route classification, listener/ECS bindings, no dangling configuration references, deterministic layout, grouped fallback, multilingual/malicious XML labels, XML pages and every supplied plan/state fixture. CLI subprocess tests cover path spaces, validate/inspect, invalid enum values, missing config and safe diagnostics.

All nine dataset groups have expected-graph.json and expected-relations.json regression baselines. Graph baselines are compared directly; semantic tests assert independent facts. These baselines were generated from the implementation and require human review. They are not an independent Terraform correctness oracle.

pnpm verify:drawio checks object IDs and parent/source/target integrity. network-view.test.ts covers AZ frames, AZ-column layout, icon cells, hidden IaC-only edges, the count-association route-table deduction (including its negative cases) and plan placement. layout.test.ts asserts that ELK lays out every dataset in both views without the grid fallback. All nine examples were opened and checked inside app.diagrams.net on 2026-10-17 (drawio-export.md); A4/A3 print legibility is still a manual review. Original real-CLI provenance is inherited from previous work; no Terraform/AWS operation was used to validate this continuation.

Performance measurements use one cold process per input and include both views. They are observations on the recorded host, not portable guarantees. Repeated performance measurements and advanced aggregation tests and independent expected relation review remain outstanding.

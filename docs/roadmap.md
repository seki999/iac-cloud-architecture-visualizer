# Roadmap

1. Perform the A4/A3 print/legibility review and test drawio-desktop/offline builds (in-app structural acceptance on app.diagrams.net is recorded in drawio-export.md).
2. Independently review all expected relations; provide equivalent deployable HCL for the synthetic scale and unknown-provider datasets without deploying it.
3. Complete type-specific route, main-table, subnet-mapping, listener-rule and module-output inference with conservative knowledge states.
4. Extend the existing explicit-ASG aggregation to ECS/Multi-AZ with ownership evidence and expansion tests.
5. Implement position/annotation configuration and previous_address migration warnings.
6. Add independently validated OpenTofu fixtures, Linux/macOS results and repeatable 50/200/500 resource measurements.
7. Package library distribution; re-verify aws4 stencil names against new diagrams.net releases.

3D, web editing, deployment and cloud backends remain outside the MVP.

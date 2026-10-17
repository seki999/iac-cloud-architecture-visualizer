import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@iacviz/schemas": r("./packages/schemas/src/index.ts"),
      "@iacviz/core": r("./packages/core/src/index.ts"),
      "@iacviz/terraform-adapter": r("./packages/terraform-adapter/src/index.ts"),
      "@iacviz/opentofu-adapter": r("./packages/opentofu-adapter/src/index.ts"),
      "@iacviz/providers-aws": r("./packages/providers-aws/src/index.ts"),
      "@iacviz/architecture-intelligence": r("./packages/architecture-intelligence/src/index.ts"),
      "@iacviz/layout": r("./packages/layout/src/index.ts"),
      "@iacviz/renderer-drawio": r("./packages/renderer-drawio/src/index.ts"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    testTimeout: 60_000,
    pool: "forks",
  },
});

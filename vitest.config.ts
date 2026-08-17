import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    environment: "node",
    coverage: { reporter: ["text", "json-summary"] }
  },
  resolve: {
    alias: {
      "@atlas/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      "@atlas/research": fileURLToPath(new URL("./packages/research/src/index.ts", import.meta.url))
    }
  }
});

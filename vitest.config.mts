import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" path — Next resolves it, Vitest does not.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    // With DATABASE_URL_TEST set (CI, tunnelled dev) every database-bound
    // test file truncates the same database — parallel workers would race.
    // The suite is small; serial files cost little and stay deterministic.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      thresholds: {
        // SPEC.md §6: a hard minimum of 80% for src/lib/.
        "src/lib/**": {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});

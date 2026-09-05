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
    // Pinned so the unit suite never depends on a developer's .env: with real
    // EMAIL_* present, an unpinned APP_ENV would let lib/email.ts resolve the
    // real provider transport and post to it from a test run.
    env: { APP_ENV: "test" },
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

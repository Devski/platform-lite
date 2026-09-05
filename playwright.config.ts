import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { SERVER_LOG_PATH, SERVER_LOG_RELATIVE_PATH } from "./e2e/server-log";

// Two projects over one web server (SPEC.md §6):
//
//   chromium     — the DB-less specs: fail-closed behaviour (401s, redirects
//                  to /login, 404s) and the render/hydration smoke of every
//                  form. This is the set the PR job runs (e2e-smoke), and it
//                  runs there against a server with no database at all.
//   chromium-db  — e2e/db/**: the #20 journey (registration → verification →
//                  profile → live public page), the password-reset round trip
//                  and axe on a live profile. Every spec there needs a
//                  database: without DATABASE_URL_TEST a local run reports
//                  them skipped, so a fresh clone works, while CI fails —
//                  there the variable is supplied by the workflow, and a
//                  green run that executed nothing would be a lie.
//
// ONE server per run, not one per project: Next 16 takes an exclusive lock on
// the dist directory, so a second `next dev` in this working tree exits with
// "Another next dev server is already running" (verified against 16.3.3 on
// 03.09.2026). The database therefore rides the single server's environment,
// which stays exactly as it is today — no DATABASE_URL, no APP_URL, no
// AUTH_SECRET — whenever DATABASE_URL_TEST is unset.
//
// So "no database" is a property of the RUN, not of a project: ci.yml gives
// each project the server it needs by invoking Playwright twice, once with
// the variable and once without. Running both projects at once locally is
// fine — every chromium assertion holds against a database too, it just does
// not prove the fail-closed behaviour that way.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// .env.example puts DATABASE_URL_TEST and the S3_* variables in .env, and
// `next dev` loads that file — but Playwright does not, so without this the
// server would see them and the test process would not. The gap is silent in
// the worst direction: the DB-backed specs would report themselves skipped,
// and the photo leg would assert the avatar-less page on a machine where
// uploads work. Node's own loader, so no dependency, and it never overwrites a
// variable already set — CI's step-level values still win. Workers re-import
// this config before they load a spec, so the values reach them as well.
try {
  process.loadEnvFile();
} catch {
  // No .env — a fresh clone, or CI, where the environment carries everything.
}

// Optional on purpose (SPEC.md §6): a fresh clone has no test database.
const testDatabaseUrl = process.env.DATABASE_URL_TEST?.trim();

// Only reached with a database configured, so the DB-less run keeps the
// server environment it has today. The signing key is generated per run and
// never written down: no session has to outlive the run, and a constant here
// would be a secret-shaped string in the repository (§7). A real environment
// still wins, so a developer pointing this at their own dev database keeps
// their sessions.
const databaseServerEnv: Record<string, string> = testDatabaseUrl
  ? {
      DATABASE_URL: testDatabaseUrl,
      APP_URL: BASE_URL,
      AUTH_SECRET:
        process.env.AUTH_SECRET ?? randomBytes(32).toString("base64url"),
    }
  : {};

// Playwright clears every project's outputDir before it starts the web
// server, so the server's log directory cannot be the outputDir itself — the
// shell redirection below would find no directory to write into. Nesting the
// artifacts one level down leaves test-results/ standing, and creating it
// here (config evaluation happens before any task) makes a fresh clone work.
mkdirSync(path.dirname(SERVER_LOG_PATH), { recursive: true });

export default defineConfig({
  testDir: "./e2e",
  // Sequential warmup of the cold dev server before the parallel workers hit
  // it — see e2e/global-setup.ts.
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "./test-results/artifacts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    // Dedicated port so e2e never attaches to an unrelated server on 3000.
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      // Matched against the absolute path, so the pattern has to be anchored
      // at the directory, not at testDir.
      testIgnore: "**/db/**",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-db",
      testDir: "./e2e/db",
      // One retry, not the global two. src/lib/auth.ts caps
      // /request-password-reset at three an hour per address, and every
      // attempt spends one: three attempts sit exactly on the cap, so the
      // last retry can only ever fail. One retry leaves a request in hand.
      retries: process.env.CI ? 1 : 0,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // The redirection is what makes the verification and reset links
    // readable: the dev transport prints every message to stdout, and a
    // worker cannot reach the server process's stream (e2e/server-log.ts).
    // It is also the only copy of the server's output — read it when the
    // server fails to start.
    command: `pnpm dev --port ${PORT} > ${SERVER_LOG_RELATIVE_PATH} 2>&1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    env: {
      // Pinned, and NOT overridable by the .env loaded above: the specs
      // register accounts at @platform-lite.test, a TLD that cannot
      // resolve. With real EMAIL_* in a developer's .env — the only way to
      // configure #22 — an unpinned APP_ENV would send every one of those
      // for real and aim a run's worth of hard bounces at a brand-new
      // sending domain. It also keeps the log transport, which is what
      // e2e/server-log.ts reads the verification links out of.
      APP_ENV: "ci",
      ...databaseServerEnv,
    },
    // Cold Turbopack compile of the first page can exceed the 60 s default.
    timeout: 120_000,
  },
});

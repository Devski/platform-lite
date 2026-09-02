import type { FullConfig } from "@playwright/test";

// Warm the dev server before the parallel workers descend on it: `next dev`
// compiles routes on first hit, and ten workers racing a cold compile queue
// turn first-loads into flaky timeout failures (different test each run).
// One sequential pass over the app's entry routes makes every later hit warm.
// CI is covered too — its runner cold-starts the same way.
const WARMUP_PATHS = [
  "/",
  "/login",
  "/register",
  "/register/verified",
  "/reset-password",
  "/reset-password/new",
  "/two-factor",
  "/email-changed",
  "/settings/account",
  "/onboarding",
  "/en/login",
  // The public profile page (#18) and, through it, the localized 404 body.
  "/some-profile",
];

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) return;
  for (const path of WARMUP_PATHS) {
    // Any response counts — redirects included; only the compile matters.
    try {
      await fetch(`${baseURL}${path}`, { redirect: "manual" });
    } catch {
      // The server is up (Playwright waited for it); a transient hiccup on a
      // warmup fetch is not worth failing the suite over.
    }
  }
}

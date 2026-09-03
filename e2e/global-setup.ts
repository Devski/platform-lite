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
  // The #20 journey walks onboarding into the profile settings.
  "/settings/profile",
  "/onboarding",
  "/en/login",
  // The public profile page (#18) and, through it, the localized 404 body.
  "/some-profile",
  // Route handlers compile on first hit too, and the #20 journey waits on
  // their answers inside a five-second assertion. The method does not matter
  // — the module is compiled before the handler is dispatched — so a GET
  // warms the POST-only ones as well; every one of these answers 401 or 405
  // without a session, which is all the warmup needs.
  "/api/auth/get-session",
  "/api/handle/availability?handle=warmup",
  "/api/profile",
  "/api/profile/handle",
  "/api/avatar/presign",
];

export default async function globalSetup(config: FullConfig) {
  // Both projects answer on the same server today, but the warmup follows the
  // projects rather than assuming that — a project pointed elsewhere would
  // otherwise cold-start under its workers.
  const baseURLs = new Set(
    config.projects
      .map((project) => project.use?.baseURL)
      .filter((baseURL): baseURL is string => Boolean(baseURL)),
  );
  for (const baseURL of baseURLs) {
    for (const path of WARMUP_PATHS) {
      // Any response counts — redirects included; only the compile matters.
      try {
        await fetch(`${baseURL}${path}`, { redirect: "manual" });
      } catch {
        // The server is up (Playwright waited for it); a transient hiccup on
        // a warmup fetch is not worth failing the suite over.
      }
    }
  }
}

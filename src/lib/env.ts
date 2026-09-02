// The one wording of the failure, shared by the thrower and the predicate
// below so the two can never drift apart.
const MISSING_ENV = "Missing required environment variable";

// Fail-loud environment access (SPEC.md §7: secrets only in env vars).
// Callers ask at first use, not at import, so `next build` and the e2e dev
// server keep working in environments that provide no runtime configuration.
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${MISSING_ENV} ${name} (see .env.example)`);
  }
  return value;
}

/**
 * True for the failure requireEnv above reports about ONE named variable.
 * Callers that must keep working without a specific piece of configuration —
 * src/proxy.ts and the public profile page, both without DATABASE_URL — use
 * it to tell that missing variable apart from a real outage, which must never
 * read as "no such profile". The name is required on purpose: an unqualified
 * match would also swallow a missing S3_* and turn every profile with a photo
 * into a 404 (#18 review). Matched by message because the failure surfaces
 * wherever the variable is first used, wrapped by whatever layer asked for it.
 */
export function isMissingEnv(error: unknown, name: string): boolean {
  return (
    error instanceof Error && error.message.startsWith(`${MISSING_ENV} ${name}`)
  );
}

// A7/§8: only production is indexed and only this exact value says so, so a
// stray space or a forgotten variable leaves the site marked noindex — the
// safe direction. The deployment sets it (#21/#24).
export function isProduction(): boolean {
  return process.env.APP_ENV?.trim() === "production";
}

// The canonical origin (APP_URL) as the browser would state it — lower-case
// host, default port dropped, no path, no trailing slash — the prefix of
// every public address, shown verbatim in front of the handle field (#15)
// and the value a request's Origin header is compared against. An unparsable
// APP_URL throws, like a missing one (requireEnv). Never hard-code the
// domain: production is architektow3d.pl (#25), the local runner whatever it
// sets.
export function appOrigin(): string {
  return new URL(requireEnv("APP_URL")).origin;
}

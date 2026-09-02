// Fail-loud environment access (SPEC.md §7: secrets only in env vars).
// Callers ask at first use, not at import, so `next build` and the e2e dev
// server keep working in environments that provide no runtime configuration.
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name} (see .env.example)`,
    );
  }
  return value;
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

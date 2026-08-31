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

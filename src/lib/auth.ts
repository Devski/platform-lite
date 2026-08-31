import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, type Database } from "@/db/client";
import * as schema from "@/db/schema";
import { localeFromRequest } from "@/i18n/request-locale";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-schemas";
import { requireEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email";

// The ONLY place that configures Better Auth (verified against the installed
// 1.7.2 sources on 31.08.2026 — the contract recorded in src/db/schema.ts).
// Delivery always goes through src/lib/email.ts, so the dev log transport and
// the future Scaleway TEM switch (#22) need no changes here.

export function createAuth(options: {
  db: Database;
  baseURL: string;
  secret: string;
}) {
  const { db, baseURL, secret } = options;
  return betterAuth({
    appName: "platform-lite",
    baseURL,
    secret,
    // Explicit even though 1.7.2 defaults to off: nothing may phone home
    // from the personal-data path (SPEC.md §7).
    telemetry: { enabled: false },
    // #4 contract: no `fields` mappings — the adapter resolves by the TS
    // property names in schema.ts, which are the Better Auth defaults.
    database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
    advanced: {
      // §9: ids come from the database (gen_random_uuid()), never the app.
      database: { generateId: "uuid" },
    },
    emailAndPassword: {
      enabled: true,
      // A1: the account stays inactive (no session possible) until the
      // verification link is clicked.
      requireEmailVerification: true,
      // A1: 8-128 characters, no composition rules — the same constants the
      // client-side signUpSchema validates with (auth-schemas.ts).
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
    },
    emailVerification: {
      sendOnSignUp: true,
      // A1: the link is valid for 24 hours.
      expiresIn: 60 * 60 * 24,
      async sendVerificationEmail({ user, url }, request) {
        // One callback serves both flows; the request path tells them apart
        // (A10 keeps first verification and re-verification as two messages).
        const isResend =
          request !== undefined &&
          new URL(request.url).pathname.endsWith("/send-verification-email");
        const kind = isResend
          ? "accountReverification"
          : "accountVerification";
        await sendEmail({
          to: user.email,
          locale: localeFromRequest(request),
          template: { kind, params: { verifyUrl: url } },
        });
      },
    },
    rateLimit: {
      // Defaults to production-only; A1 demands the same behavior everywhere
      // (and the integration tests exercise it).
      enabled: true,
      customRules: {
        // A1: resend at most 3 per hour. The built-in special rule for this
        // path is 3 per minute — far looser than the criterion.
        "/send-verification-email": { window: 60 * 60, max: 3 },
      },
    },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

export function getAuth(): ReturnType<typeof createAuth> {
  if (!instance) {
    instance = createAuth({
      db: getDb(),
      baseURL: requireEnv("APP_URL"),
      secret: requireEnv("AUTH_SECRET"),
    });
  }
  return instance;
}

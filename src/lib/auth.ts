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
  /** Test override for the A2 lifetimes; production uses the defaults. */
  session?: { expiresIn: number; updateAge: number };
  /**
   * Test override: origin and redirect-target checks auto-skip under
   * NODE_ENV=test (captured at library import, so tests cannot stub it) —
   * this forces them on so the open-redirect defense stays provable.
   */
  enforceOriginChecks?: boolean;
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
      ...(options.enforceOriginChecks ? { disableOriginCheck: false } : {}),
    },
    verification: {
      // A reset token is a bearer credential for account takeover — hash it
      // at rest so a read-only database leak (backup, SQL injection) cannot
      // redeem live links. Scoped by prefix; other identifiers stay plain.
      storeIdentifier: {
        default: "plain",
        overrides: { "reset-password:": "hashed" },
      },
    },
    session: {
      // A2: 30 days, renewable. Renewal happens in /get-session: once the
      // window is older than updateAge, expiresAt slides forward by the full
      // expiresIn and the cookie is re-issued. httpOnly and sameSite=lax are
      // the library defaults; Secure switches on with an https baseURL
      // (verified against the installed 1.7.2 cookie builder).
      expiresIn: options.session?.expiresIn ?? 60 * 60 * 24 * 30,
      updateAge: options.session?.updateAge ?? 60 * 60 * 24,
    },
    emailAndPassword: {
      enabled: true,
      // A1: the account stays inactive (no session possible) until the
      // verification link is clicked.
      requireEmailVerification: true,
      // A1: 8-128 characters, no composition rules — the same constants the
      // client-side signUpSchema validates with (auth-schemas.ts). The reset
      // endpoint enforces the same bounds on the new password.
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      // A3: the link is valid for 60 minutes (and single-use — the token is
      // consumed on submit). Explicit even though it equals the 1.7.2 default,
      // so the criterion cannot drift with a library upgrade.
      resetPasswordTokenExpiresIn: 60 * 60,
      // KNOWN GAP until #22: with advanced.backgroundTasks unset the library
      // awaits this send on the response path, so a known address answers
      // slower than an unknown one by a full delivery round-trip — a timing
      // channel for account enumeration. Negligible with the dev log
      // transport; the production transport must deliver off-path
      // (backgroundTasks.handler or a queueing transport) — recorded on #22.
      async sendResetPassword({ user, url }, request) {
        await sendEmail({
          to: user.email,
          locale: localeFromRequest(request),
          template: { kind: "passwordReset", params: { resetUrl: url } },
        });
      },
      // A3: after a successful change, a notification to the account address.
      // Best-effort by contract: the library awaits this hook un-wrapped
      // between the password update and the session revocation, so a failed
      // delivery would otherwise return 500 with the new password live and
      // every old session intact — the A3 outcome outranks the notification.
      async onPasswordReset({ user }, request) {
        try {
          await sendEmail({
            to: user.email,
            locale: localeFromRequest(request),
            template: { kind: "passwordChanged", params: {} },
          });
        } catch (error) {
          console.error("[auth] password-changed notification failed:", error);
        }
      },
      // A completed reset implies the old password may be in someone else's
      // hands — no live session survives it (decision of 01.09.2026, OWASP
      // recommendation; A3 itself is silent on sessions).
      revokeSessionsOnPasswordReset: true,
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
        const kind = isResend ? "accountReverification" : "accountVerification";
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
      //
      // TRUST CONTRACT: limits are keyed by the client IP taken from
      // x-forwarded-for. That is only meaningful when the reverse proxy
      // OVERWRITES the header and the Node port is never published directly
      // (recorded on the deployment issues #21/#24; a second appending hop,
      // e.g. a CDN, needs advanced.ipAddress.trustedProxies or every visitor
      // collapses into one shared bucket).
      enabled: true,
      customRules: {
        // A1: resend at most 3 per hour. The built-in special rule for this
        // path is 3 per minute — far looser than the criterion.
        "/send-verification-email": { window: 60 * 60, max: 3 },
        // A3 asks for rate limiting without a number; mirror the A1 cap
        // (decision of 01.09.2026) — the built-in 3 per minute would still
        // let one IP flood a mailbox with 180 messages an hour.
        "/request-password-reset": { window: 60 * 60, max: 3 },
      },
    },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

export function getAuth(): ReturnType<typeof createAuth> {
  if (!instance) {
    const baseURL = requireEnv("APP_URL");
    // A2 requires the Secure cookie attribute, and Better Auth derives it
    // from the base URL scheme — a production deployment behind plain http
    // would silently ship non-Secure session cookies. Fail at startup instead.
    if (
      process.env.NODE_ENV === "production" &&
      !baseURL.startsWith("https://")
    ) {
      throw new Error(
        "APP_URL must be https:// in production — the session cookie's Secure attribute depends on it (A2)",
      );
    }
    instance = createAuth({
      db: getDb(),
      baseURL,
      secret: requireEnv("AUTH_SECRET"),
    });
  }
  return instance;
}

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";
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

// A1/A10: the verification JWTs (sign-up and e-mail change) live this long.
const EMAIL_VERIFICATION_EXPIRES_IN = 60 * 60 * 24;

// The e-mail-change JWT is stateless — nothing stored can expire it early. The
// #10 obligation (a password reset must kill a pending change, or the advice
// in the change notice is useless) therefore rides on this stateful marker:
// written when a change is requested, REQUIRED by the /verify-email gate
// below, deleted on password reset, on a newer request and on completion.
// Deliberately outside the storeIdentifier hashing — the key is a predictable
// user id, not a bearer secret.
function emailChangeMarker(userId: string): string {
  return `email-change-pending:${userId}`;
}

/** One pending change per user — recording a new one supersedes the old. */
async function recordPendingEmailChange(
  db: Database,
  userId: string,
  newEmail: string,
): Promise<void> {
  await clearPendingEmailChange(db, userId);
  await db.insert(schema.verifications).values({
    identifier: emailChangeMarker(userId),
    value: newEmail,
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_EXPIRES_IN * 1000),
  });
}

async function clearPendingEmailChange(
  db: Database,
  userId: string,
): Promise<void> {
  await db
    .delete(schema.verifications)
    .where(eq(schema.verifications.identifier, emailChangeMarker(userId)));
}

// Add a status marker to the callbackURL carried by a /verify-email link, so
// the landing page can tell the two-step change's approval click apart from
// its final verification click (both otherwise share one callbackURL).
function withCallbackStatus(verifyUrl: string, status: string): string {
  const link = new URL(verifyUrl);
  const callbackURL = link.searchParams.get("callbackURL") ?? "/email-changed";
  const separator = callbackURL.includes("?") ? "&" : "?";
  link.searchParams.set(
    "callbackURL",
    `${callbackURL}${separator}status=${status}`,
  );
  return link.href;
}

// Payload-only decode, no signature check: the gate merely decides whether to
// consult the marker, and the endpoint behind it verifies the signature — a
// forged payload can only make the gate reject sooner.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString()) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

// Tasks the handler above has started but not finished. Delivery no longer
// blocks the response, so nothing else would keep a reference to it — and a
// test asserting "the message arrived" would race the send it triggered.
const inFlightBackgroundTasks = new Set<Promise<void>>();

function trackBackgroundTask(task: Promise<unknown>): void {
  const tracked = task.then(
    () => {},
    (error: unknown) => {
      // The only place this is visible now: SPEC §10 counts a swallowed 2FA
      // code as a lockout, so it must be findable in the logs.
      console.error("[auth] background e-mail delivery failed:", error);
    },
  );
  inFlightBackgroundTasks.add(tracked);
  void tracked.finally(() => inFlightBackgroundTasks.delete(tracked));
}

/**
 * Waits for every background delivery started so far. For tests, which must
 * observe a message the request deliberately stopped waiting for. Loops
 * because settling one task can start another (a hook that sends in turn).
 */
export async function flushBackgroundTasks(): Promise<void> {
  while (inFlightBackgroundTasks.size > 0) {
    await Promise.all([...inFlightBackgroundTasks]);
  }
}

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
    //
    // No `transaction: true`, and that is load-bearing since #172: the
    // library wraps sign-up in a transaction when the adapter says it can,
    // and that wrapper would hold a connection across scrypt AND the e-mail
    // provider's HTTP call — straight into the idle-transaction bound. With
    // it off the wrapper is a pass-through and nothing pins a connection.
    database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
    advanced: {
      // §9: ids come from the database (gen_random_uuid()), never the app.
      database: { generateId: "uuid" },
      // #22 closes the gap sendResetPassword used to carry: the library
      // awaits delivery on the response path unless this handler exists, so
      // with a real provider a registered address answers a network
      // round-trip slower than an unknown one. That is an enumeration
      // oracle, and it defeats work the library does deliberately —
      // sign-up returns an identical body for a taken address and hashes
      // the password anyway to equalise timing. Delivery is best-effort;
      // the response must not wait for it.
      backgroundTasks: { handler: trackBackgroundTask },
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
      // Delivered off the response path (advanced.backgroundTasks above), so
      // this send does not answer "is that address registered" in its
      // timing. Closed in #22, when the transport stopped being a no-op.
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
        // #10: the change-notice advises a reset as the recovery action, so a
        // completed reset must kill any pending e-mail change — done first and
        // un-wrapped: skipping it silently would leave the takeover path open.
        await clearPendingEmailChange(db, user.id);
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
      expiresIn: EMAIL_VERIFICATION_EXPIRES_IN,
      async sendVerificationEmail({ user, url, token }, request) {
        const path = request ? new URL(request.url).pathname : "";
        const locale = localeFromRequest(request);

        // Step two of the two-step e-mail change: once the CURRENT address has
        // approved, the library sends this to the NEW address (the only place
        // an updateTo-bearing token reaches this callback). user.email is
        // already the new address. Clicking it is what finally switches it.
        if (typeof decodeJwtPayload(token)?.updateTo === "string") {
          await sendEmail({
            to: user.email,
            locale,
            // Land this final click on a distinct state (?status=done) so the
            // page says "changed", not the approval step's "check your new
            // inbox" — both steps otherwise share the one callbackURL. A
            // relative path keeps its query through the library's origin check.
            template: {
              kind: "emailChangeVerification",
              params: { verifyUrl: withCallbackStatus(url, "done") },
            },
          });
          return;
        }

        // Sign-up and its resend (A10 keeps them two distinct messages).
        const isResend = path.endsWith("/send-verification-email");
        const kind = isResend ? "accountReverification" : "accountVerification";
        await sendEmail({
          to: user.email,
          locale,
          template: { kind, params: { verifyUrl: url } },
        });
      },
      async afterEmailVerification(user) {
        // The pending-change marker is consumed with the change itself; a
        // no-op for plain sign-up verifications.
        await clearPendingEmailChange(db, user.id);
      },
    },
    user: {
      changeEmail: {
        enabled: true,
        // #10 two-step (decision of 01.09.2026, option B): setting this
        // callback makes 1.7.2 send the FIRST link to the CURRENT address, so
        // a stolen session alone cannot move the account — the old-mailbox
        // owner has to approve. Approve here (change-email-confirmation) →
        // library then sends the NEW address a change-email-verification link
        // (sendVerificationEmail above) → that second click switches it.
        async sendChangeEmailConfirmation({ user, newEmail, url }, request) {
          // Record the pending target before the link goes out: the
          // /verify-email gate below refuses both steps' links unless a live
          // marker matches, so a newer request or a password reset kills the
          // older link. Only reached for a FREE newEmail (a taken one returns
          // early inside the endpoint), so — like the reset send — this awaited
          // delivery is a known timing channel for address existence, deferred
          // to #22's off-path delivery.
          await recordPendingEmailChange(db, user.id, newEmail);
          await sendEmail({
            to: user.email,
            locale: localeFromRequest(request),
            template: {
              kind: "emailChangeConfirmation",
              params: { confirmUrl: url, newEmail },
            },
          });
        },
      },
    },
    hooks: {
      // The stateful gate for the stateless change-email JWT (#10): both steps
      // of the change ride a /verify-email link carrying updateTo, and each
      // must match a live pending-change marker for that user — the approve
      // step and the verify step alike, and only those two request types (the
      // legacy instant-update default is refused).
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/verify-email" || !ctx.request) return;
        const requestUrl = new URL(ctx.request.url);
        const token = requestUrl.searchParams.get("token");
        const payload = token ? decodeJwtPayload(token) : null;
        const updateTo = payload?.updateTo;
        if (typeof updateTo !== "string") return;
        const isChangeEmailStep =
          payload?.requestType === "change-email-confirmation" ||
          payload?.requestType === "change-email-verification";

        const reject = () => {
          // This gate runs before the endpoint's own originCheck middleware,
          // so it must validate callbackURL itself — otherwise a crafted link
          // on the real origin (unsigned payload is enough to reach here)
          // would bounce the victim to any external site. Trust the same list
          // the library does; anything else falls back to a bare 401.
          const callbackURL = requestUrl.searchParams.get("callbackURL");
          if (
            callbackURL &&
            ctx.context.isTrustedOrigin(callbackURL, {
              allowRelativePaths: true,
            })
          ) {
            const target = new URL(callbackURL, ctx.context.baseURL);
            target.searchParams.set("error", "INVALID_TOKEN");
            throw ctx.redirect(target.href);
          }
          throw new APIError("UNAUTHORIZED", {
            message: "Invalid token",
            code: "INVALID_TOKEN",
          });
        };

        if (!isChangeEmailStep) reject();
        const email = payload?.email;
        if (typeof email !== "string") reject();
        const [account] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.email, email as string));
        // No such user: fall through to the endpoint's own USER_NOT_FOUND.
        if (!account) return;
        const [marker] = await db
          .select()
          .from(schema.verifications)
          .where(
            eq(schema.verifications.identifier, emailChangeMarker(account.id)),
          );
        if (
          !marker ||
          marker.value !== updateTo.toLowerCase() ||
          marker.expiresAt < new Date()
        ) {
          reject();
        }
      }),
      // A10: a password change from the settings confirms by e-mail. The
      // endpoint has no callback of its own, so the after hook fills in;
      // the account address comes from the endpoint's own response.
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/change-password") return;
        const returned = ctx.context.returned;
        if (returned instanceof APIError) return;
        const email = (returned as { user?: { email?: unknown } } | undefined)
          ?.user?.email;
        if (typeof email !== "string") return;
        try {
          await sendEmail({
            to: email,
            locale: localeFromRequest(ctx.request),
            template: { kind: "passwordChanged", params: {} },
          });
        } catch (error) {
          console.error("[auth] password-changed notification failed:", error);
        }
      }),
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
        // #10 (decisions of 01.09.2026): e-mail change mirrors the other
        // senders; password change tolerates typos but stops a stolen
        // session from grinding through current-password guesses (the
        // built-in 3 per 10 s allows over a thousand an hour).
        "/change-email": { window: 60 * 60, max: 3 },
        "/change-password": { window: 60 * 60, max: 10 },
        // #29: every login of an e-mail-OTP account sends a code, so cap the
        // sender the way the other transactional senders are capped — the
        // plugin default (3 per 10 s ≈ 1000/hour) would let one IP flood the
        // victim's inbox with login codes once a password leaks. More generous
        // than the 3/hour senders above because it fires at login on
        // potentially shared IPs; a true per-user bound needs app state (#22).
        // Same x-forwarded-for trust contract and IP-rotation caveat as above.
        "/two-factor/send-otp": { window: 60 * 60, max: 20 },
        // #22: sign-up is a sender too — it mails a verification link to
        // whatever address it is handed. Until the transport was real that
        // only wrote to a log; now the built-in default (3 per 10 s, so
        // ~1000/hour) would let one IP post that many messages from our
        // domain to third parties, burning the TEM quota real users need
        // for verification and reset, and the sender reputation with it.
        // Higher than the 3/hour senders because a shared IP (an office, a
        // carrier NAT) may hold several genuine sign-ups in a day.
        "/sign-up/email": { window: 60 * 60, max: 10 },
      },
    },
    // #29: optional two-factor authentication, opt-in per user (decision of
    // 01.09.2026 — both methods). Two ways to enrol:
    //   - e-mail OTP: the easy default; a 6-digit code to the account address
    //     at each login. Big win against leaked/reused passwords, zero setup.
    //   - TOTP (authenticator app) + backup codes: the stronger option that
    //     also survives a compromised mailbox.
    // The plugin encrypts the TOTP secret and backup codes at rest (defaults
    // kept). Guessing limits differ by method: TOTP and backup codes get the
    // per-account lockout (10 failed challenges → 15 min) AND a 5-per-challenge
    // cap, because they have a two_factors row to track. E-mail OTP enrols
    // row-less (just the flag), so it relies instead on a 5-guesses-per-code
    // cap, the code's ~3 min TTL, and the /two-factor/send-otp rate limit above
    // — the account lockout does NOT apply to it. Do not loosen those without
    // adding a per-account cap for OTP.
    plugins: [
      twoFactor({
        otpOptions: {
          // Store only a hash of the live code, never the plaintext (default
          // is "plain"); it is short-lived but there is no reason to keep it.
          storeOTP: "hashed",
          // Unlike the emailAndPassword callbacks (which receive the Request),
          // the plugin hands this one the whole endpoint context — the Request
          // is on ctx.request.
          async sendOTP({ user, otp }, ctx) {
            await sendEmail({
              to: user.email,
              locale: localeFromRequest(ctx?.request),
              template: { kind: "twoFactorCode", params: { code: otp } },
            });
          },
        },
      }),
    ],
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

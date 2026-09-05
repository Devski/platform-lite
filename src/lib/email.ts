import { createTranslator, hasLocale } from "next-intl";
import en from "../../messages/en.json";
import pl from "../../messages/pl.json";
import { requireEnv } from "@/lib/env";
import { routing, type Locale } from "@/i18n/routing";

// The ONLY place that composes and delivers e-mail — same principle as G1 for
// storage. Template texts live in the messages/ dictionaries (A8); delivery
// goes through EmailTransport, so composition stays testable and provider-free.

const MESSAGES = { pl, en } as const satisfies Record<Locale, unknown>;

export type EmailTemplate =
  | { kind: "accountVerification"; params: { verifyUrl: string } }
  | { kind: "accountReverification"; params: { verifyUrl: string } }
  | { kind: "passwordReset"; params: { resetUrl: string } }
  | { kind: "passwordChanged"; params: Record<string, never> }
  // #29: the one-time login code for e-mail-based two-factor authentication.
  | { kind: "twoFactorCode"; params: { code: string } }
  // A10 "address change ×2", two-step (decision of 01.09.2026): the CURRENT
  // address must approve before anything moves — so the confirmation link
  // goes there and doubles as the "someone is changing your address" notice
  // (its copy advises a password reset if the request was not the owner's).
  | {
      kind: "emailChangeConfirmation";
      params: { confirmUrl: string; newEmail: string };
    }
  // Then the NEW address verifies it is reachable; only this second click
  // switches the account address.
  | { kind: "emailChangeVerification"; params: { verifyUrl: string } }
  | {
      kind: "handleChanged";
      params: { oldHandle: string; newHandle: string; profileUrl: string };
    };

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailTransport {
  deliver(message: EmailMessage): Promise<void>;
}

export function renderEmail(
  template: EmailTemplate,
  locale: Locale,
): { subject: string; body: string } {
  // A broken transactional message must fail loudly, never reach a user as a
  // dictionary key path (next-intl's default onError only logs): guard the
  // locale and make every translator error throw.
  if (!hasLocale(routing.locales, locale)) {
    throw new Error(`unsupported email locale: ${String(locale)}`);
  }
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: "Email",
    onError(error) {
      throw error;
    },
    getMessageFallback({ key }) {
      throw new Error(`email message failed to render: ${key}`);
    },
  });
  // ?? {} forces the ICU path even for an untyped caller passing undefined —
  // next-intl's no-values fast path would return unfilled {placeholders}.
  const params = (template.params ?? {}) as Record<string, string>;
  return {
    subject: t(`${template.kind}.subject`, params),
    body: t(`${template.kind}.body`, params),
  };
}

// Dev/test delivery (#6): the full message, action links included, goes to the
// server log — no domain and no provider needed to exercise every flow.
export const logTransport: EmailTransport = {
  async deliver(message) {
    console.log(
      `[email] to=${message.to}\n[email] subject=${message.subject}\n${message.body}`,
    );
  },
};

const TEM_TIMEOUT_MS = 10_000;

/**
 * A display name as an address header may carry it. Exported for its tests.
 */
export function encodeDisplayName(name: string): string {
  // Printable ASCII goes as a quoted string, which needs the two characters
  // that end it escaped. Anything else — Polish diacritics above all — has
  // to be an RFC 2047 encoded word, because a header is ASCII by definition.
  if (/^[ -~]*$/.test(name)) {
    return `"${name.replace(/(["\\])/g, "\\$1")}"`;
  }
  return `=?UTF-8?B?${Buffer.from(name, "utf8").toString("base64")}?=`;
}

// #22: Scaleway Transactional Email over its HTTP API rather than SMTP.
// Sending by SMTP from Node needs a mailer library; this needs `fetch`, which
// the runtime already has — a whole production dependency is a lot to carry
// for six short messages, and `lib/email.ts` is the thin interface that keeps
// the provider swappable either way (the G1 pattern, applied to mail).
export function createScalewayTransport(config: {
  apiKey: string;
  projectId: string;
  from: string;
  region: string;
  /**
   * Where a human reply should land. Optional, and worth setting: the
   * sending subdomain's MX points at the provider, which discards
   * everything, so without this a reply to a verification e-mail vanishes
   * silently. People do reply to these.
   */
  replyTo?: string;
  /**
   * Display name shown instead of the bare address, on both the sender and
   * the reply address. A recognisable name is the difference between "who
   * is kontakt@dev.…" and a message the reader trusts enough to open.
   */
  fromName?: string;
}): EmailTransport {
  // Interpolated into the URL, so it is checked rather than trusted. There is
  // no exfiltration path (the origin is a literal and this lands in the path),
  // but an unchecked typo would surface much later as a puzzling 404 on the
  // first real send instead of a clear failure here.
  if (!/^[a-z]{2}-[a-z]{3}$/.test(config.region)) {
    throw new Error(`EMAIL_REGION is not a Scaleway region: ${config.region}`);
  }
  const endpoint = `https://api.scaleway.com/transactional-email/v1alpha1/regions/${config.region}/emails`;
  // The provider takes the sender's name as a JSON field and encodes it
  // itself. Reply-To is a raw header, so the name has to be encoded here:
  // a quoted string for plain ASCII, and RFC 2047 otherwise — without it
  // "Architektów 3D" would reach the reader as mojibake, or the comma in a
  // name like "Kowalski, Jan" would split the header into two addresses.
  const replyToHeader =
    config.replyTo && config.fromName
      ? `${encodeDisplayName(config.fromName)} <${config.replyTo}>`
      : config.replyTo;
  return {
    async deliver(message) {
      const response = await fetch(endpoint, {
        method: "POST",
        // undici gives no overall deadline (its headers timeout is 300 s), and
        // this call sits on the sign-up/reset/2FA response path. Mail is
        // best-effort; holding an auth request for minutes because the
        // provider is degraded is not.
        signal: AbortSignal.timeout(TEM_TIMEOUT_MS),
        headers: {
          "X-Auth-Token": config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: config.projectId,
          from: { email: config.from, ...(config.fromName ? { name: config.fromName } : {}) },
          to: [{ email: message.to }],
          subject: message.subject,
          // Plain text only, deliberately: every template is a short message
          // with one link, and an HTML part would double what has to be
          // translated and reviewed for no gain (A10 is seven transactional
          // messages, not a newsletter).
          text: message.body,
          ...(replyToHeader
            ? {
                additional_headers: [
                  { key: "Reply-To", value: replyToHeader },
                ],
              }
            : {}),
        }),
      }).catch((cause: unknown) => {
        // DNS, TLS, a reset connection or the timeout above all arrive here as
        // a bare `TypeError: fetch failed` with nothing naming the mail path.
        throw new Error("Scaleway TEM could not be reached", { cause });
      });
      if (!response.ok) {
        // The body carries the provider's reason; the address does not, and
        // a rejected verification e-mail is a lost account (SPEC §10), so the
        // caller gets something actionable rather than a bare status.
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Scaleway TEM refused the message (${response.status}): ${detail.slice(0, 300)}`,
        );
      }
    },
  };
}

const EMAIL_VARIABLES = {
  apiKey: "EMAIL_API_KEY",
  projectId: "EMAIL_PROJECT_ID",
  from: "EMAIL_FROM",
} as const;

/** True when every variable the provider transport needs is present. */
export function isEmailConfigured(): boolean {
  return Object.values(EMAIL_VARIABLES).every(
    (name) => (process.env[name]?.trim() ?? "") !== "",
  );
}

// APP_ENV values whose runs must never reach a real mailbox, whatever happens
// to be in the environment. The e2e suite registers accounts at
// `@platform-lite.test`, a TLD that cannot resolve: sending those for real
// would aim a stream of hard bounces at a brand-new sending domain and burn
// the reputation SPEC §10 depends on. Credentials in a developer .env are
// there to configure a DEPLOYMENT, not to arm `pnpm dev`; e2e also reads the
// delivered message back out of the log (e2e/db/email-log.ts), so the log
// transport is what those environments are built around (#6).
// Note this is an allowlist of harnesses, not a list of "real" environments:
// a typo in APP_ENV therefore fails towards sending rather than towards
// silently logging tokens.
// `preview` is here for a second reason (#31): a PR preview is reachable by
// anyone holding the link, and would otherwise mail real verification messages
// to any address typed into it — from our domain, against our quota.
const HARNESS_ENVIRONMENTS = new Set(["local", "ci", "test", "preview"]);

function isHarnessEnvironment(): boolean {
  return HARNESS_ENVIRONMENTS.has(process.env.APP_ENV?.trim() ?? "");
}

// Module-level slot so code that cannot thread a transport through (Better
// Auth callbacks in #7-#10) stays testable. Resolved on first use, not at
// import: route modules are evaluated at build time and by the database-less
// e2e job, where no EMAIL_* exists and none is needed.
let activeTransport: EmailTransport | undefined;

export function setEmailTransport(transport: EmailTransport): void {
  activeTransport = transport;
}

/** Drops back to environment-driven selection. For tests. */
export function resetEmailTransport(): void {
  activeTransport = undefined;
}

function resolveTransport(): EmailTransport {
  if (activeTransport) return activeTransport;
  // A deployed environment ALWAYS sends. It must not quietly fall back to the
  // log: logTransport prints the whole body, so an incomplete .env in
  // production would both stop every verification e-mail (sign-up still
  // answers 200 — nothing reports the failure) and write live verification
  // and password-reset links into the container log, where anyone with log
  // access could complete a reset for any address. requireEnv names the
  // variable that is missing, the way every other secret in this codebase
  // fails (lib/env.ts).
  activeTransport = isHarnessEnvironment()
    ? logTransport
    : createScalewayTransport({
        apiKey: requireEnv(EMAIL_VARIABLES.apiKey),
        projectId: requireEnv(EMAIL_VARIABLES.projectId),
        from: requireEnv(EMAIL_VARIABLES.from),
        region: process.env.EMAIL_REGION?.trim() || "fr-par",
        fromName: process.env.EMAIL_FROM_NAME?.trim() || undefined,
        replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
      });
  return activeTransport;
}

// Test helper: capture deliveries instead of logging them.
export function createMemoryTransport(): {
  transport: EmailTransport;
  delivered: EmailMessage[];
} {
  const delivered: EmailMessage[] = [];
  return {
    delivered,
    transport: {
      async deliver(message) {
        delivered.push(message);
      },
    },
  };
}

export async function sendEmail(
  options: { to: string; locale: Locale; template: EmailTemplate },
  transport?: EmailTransport,
): Promise<void> {
  const { subject, body } = renderEmail(options.template, options.locale);
  await (transport ?? resolveTransport()).deliver({
    to: options.to,
    subject,
    body,
  });
}

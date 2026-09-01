import { createTranslator, hasLocale } from "next-intl";
import en from "../../messages/en.json";
import pl from "../../messages/pl.json";
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

// Module-level slot so code that cannot thread a transport through (Better
// Auth callbacks in #7-#10) stays testable, and #22 can wire Scaleway TEM
// (EMAIL_SMTP_*) here without touching the callers.
let activeTransport: EmailTransport = logTransport;

export function setEmailTransport(transport: EmailTransport): void {
  activeTransport = transport;
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
  await (transport ?? activeTransport).deliver({
    to: options.to,
    subject,
    body,
  });
}

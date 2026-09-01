import { afterEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/i18n/routing";
import {
  createMemoryTransport,
  logTransport,
  renderEmail,
  sendEmail,
  setEmailTransport,
  type EmailMessage,
  type EmailTemplate,
} from "./email";

// Keyed by the union, so adding a template kind without a sample here fails
// the typecheck — coverage of all A10 messages is a compile-time property.
const SAMPLES_BY_KIND: {
  [K in EmailTemplate["kind"]]: Extract<EmailTemplate, { kind: K }>;
} = {
  accountVerification: {
    kind: "accountVerification",
    params: { verifyUrl: "https://x.test/verify?t=1" },
  },
  accountReverification: {
    kind: "accountReverification",
    params: { verifyUrl: "https://x.test/verify?t=2" },
  },
  passwordReset: {
    kind: "passwordReset",
    params: { resetUrl: "https://x.test/reset?t=3" },
  },
  passwordChanged: { kind: "passwordChanged", params: {} },
  twoFactorCode: { kind: "twoFactorCode", params: { code: "012345" } },
  emailChangeConfirmation: {
    kind: "emailChangeConfirmation",
    params: { confirmUrl: "https://x.test/confirm?t=4", newEmail: "new@example.com" },
  },
  emailChangeVerification: {
    kind: "emailChangeVerification",
    params: { verifyUrl: "https://x.test/verify?t=5" },
  },
  handleChanged: {
    kind: "handleChanged",
    params: {
      oldHandle: "old-studio",
      newHandle: "new-studio",
      profileUrl: "https://x.test/new-studio",
    },
  },
};
const SAMPLES = Object.values(SAMPLES_BY_KIND);

describe("renderEmail (A10: all transactional templates)", () => {
  it.each(SAMPLES)(
    "renders $kind in both locales with every param in the body",
    (template) => {
      for (const locale of ["pl", "en"] as const) {
        const { subject, body } = renderEmail(template, locale);
        expect(subject.trim()).not.toBe("");
        expect(body.trim()).not.toBe("");
        for (const value of Object.values(template.params)) {
          expect(body).toContain(String(value));
        }
      }
    },
  );

  it.each(SAMPLES)(
    "$kind subject and body actually differ between locales",
    (template) => {
      expect(renderEmail(template, "pl").body).not.toBe(
        renderEmail(template, "en").body,
      );
      expect(renderEmail(template, "pl").subject).not.toBe(
        renderEmail(template, "en").subject,
      );
    },
  );

  it("verification links state the 24-hour validity (A1)", () => {
    for (const locale of ["pl", "en"] as const) {
      expect(
        renderEmail(SAMPLES_BY_KIND.accountVerification, locale).body,
      ).toContain("24");
      expect(
        renderEmail(SAMPLES_BY_KIND.accountReverification, locale).body,
      ).toContain("24");
    }
  });

  it("the reset link states the 60-minute single-use validity (A3)", () => {
    for (const locale of ["pl", "en"] as const) {
      expect(renderEmail(SAMPLES_BY_KIND.passwordReset, locale).body).toContain(
        "60",
      );
    }
  });

  it("throws on an unsupported locale instead of rendering a fallback", () => {
    expect(() =>
      renderEmail(
        SAMPLES_BY_KIND.accountVerification,
        "de" as unknown as Locale,
      ),
    ).toThrow(/unsupported email locale/);
  });

  it("throws on a missing ICU param instead of delivering a key path", () => {
    const broken = {
      kind: "passwordReset",
      params: {},
    } as unknown as EmailTemplate;
    expect(() => renderEmail(broken, "pl")).toThrow();
  });
});

describe("sendEmail", () => {
  afterEach(() => {
    setEmailTransport(logTransport);
  });

  it("delivers the rendered message through an explicitly given transport", async () => {
    const { transport, delivered } = createMemoryTransport();
    await sendEmail(
      {
        to: "user@example.com",
        locale: "pl",
        template: SAMPLES_BY_KIND.accountVerification,
      },
      transport,
    );
    expect(delivered).toHaveLength(1);
    expect(delivered[0].to).toBe("user@example.com");
    expect(delivered[0].body).toContain("https://x.test/verify?t=1");
  });

  it("uses the module transport slot when no transport is given (the #7+ callback path)", async () => {
    const { transport, delivered } = createMemoryTransport();
    setEmailTransport(transport);
    await sendEmail({
      to: "slot@example.com",
      locale: "en",
      template: SAMPLES_BY_KIND.passwordChanged,
    });
    expect(delivered).toHaveLength(1);
    expect(delivered[0].to).toBe("slot@example.com");
  });

  it("logTransport logs the full message including action links", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const message: EmailMessage = {
      to: "a@example.com",
      subject: "Subject",
      body: "click https://x.test/link",
    };
    await logTransport.deliver(message);
    const output = spy.mock.calls.flat().join(" ");
    expect(output).toContain("a@example.com");
    expect(output).toContain("Subject");
    expect(output).toContain("https://x.test/link");
    spy.mockRestore();
  });
});

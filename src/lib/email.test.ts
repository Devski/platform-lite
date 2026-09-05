import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/i18n/routing";
import {
  createMemoryTransport,
  createScalewayTransport,
  encodeDisplayName,
  isEmailConfigured,
  resetEmailTransport,
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

describe("Scaleway transport (#22)", () => {
  const config = {
    apiKey: "secret-key",
    projectId: "project-1",
    from: "kontakt@dev.example.test",
    region: "fr-par",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    // In afterEach, not at the end of the body: a failing expect would
    // otherwise leak EMAIL_* into every later file (fileParallelism is off,
    // so they share the worker) and the resolver reads process.env.
    vi.unstubAllEnvs();
    resetEmailTransport();
  });

  it("posts the message to the region's endpoint", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("", { status: 200 });
    });

    await createScalewayTransport(config).deliver({
      to: "someone@example.test",
      subject: "Potwierdź adres",
      body: "https://x.test/verify",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails",
    );
    // The secret travels in the header, never in the URL or the body.
    expect(calls[0].init.headers).toMatchObject({ "X-Auth-Token": "secret-key" });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      project_id: "project-1",
      from: { email: "kontakt@dev.example.test" },
      to: [{ email: "someone@example.test" }],
      subject: "Potwierdź adres",
      text: "https://x.test/verify",
    });
  });

  it("carries the provider's reason when a message is refused", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response('{"message":"domain not verified"}', { status: 403 }),
    );
    // A silently dropped verification e-mail is a lost account with no signal
    // (SPEC §10), so the failure has to say what the provider objected to.
    await expect(
      createScalewayTransport(config).deliver({
        to: "a@b.test",
        subject: "s",
        body: "b",
      }),
    ).rejects.toThrow(/403[\s\S]*domain not verified/);
  });

  it("reports itself unconfigured while any variable is missing", () => {
    vi.stubEnv("EMAIL_API_KEY", "k");
    vi.stubEnv("EMAIL_PROJECT_ID", "p");
    vi.stubEnv("EMAIL_FROM", "");
    expect(isEmailConfigured()).toBe(false);
    vi.stubEnv("EMAIL_FROM", "kontakt@dev.example.test");
    expect(isEmailConfigured()).toBe(true);
  });

  it("sets Reply-To only when one is configured", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response("", { status: 200 });
    });
    const message = { to: "a@b.test", subject: "s", body: "b" };

    await createScalewayTransport(config).deliver(message);
    await createScalewayTransport({
      ...config,
      replyTo: "kontakt@example.test",
    }).deliver(message);

    expect(bodies[0]).not.toHaveProperty("additional_headers");
    expect(bodies[1]).toMatchObject({
      additional_headers: [
        { key: "Reply-To", value: "kontakt@example.test" },
      ],
    });
  });

  it("shows a display name on both the sender and the reply address", async () => {
    const bodies: { from: { name?: string }; additional_headers?: unknown }[] =
      [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response("", { status: 200 });
    });

    await createScalewayTransport({
      ...config,
      replyTo: "kontakt@example.test",
      fromName: "Architektow 3d",
    }).deliver({ to: "a@b.test", subject: "s", body: "b" });

    expect(bodies[0].from).toEqual({
      email: "kontakt@dev.example.test",
      name: "Architektow 3d",
    });
    expect(bodies[0].additional_headers).toEqual([
      { key: "Reply-To", value: '"Architektow 3d" <kontakt@example.test>' },
    ]);
  });

  it("encodes a display name that a header cannot carry raw", () => {
    // Plain ASCII: quoted, so a comma cannot split the header into two
    // addresses and a quote cannot end the string early.
    expect(encodeDisplayName("Architektow 3d")).toBe('"Architektow 3d"');
    expect(encodeDisplayName('Kowalski, Jan "JK"')).toBe(
      '"Kowalski, Jan \\"JK\\""',
    );
    // Polish diacritics are not ASCII, and a header is: RFC 2047 or mojibake.
    expect(encodeDisplayName("Architektów 3D")).toBe(
      `=?UTF-8?B?${Buffer.from("Architektów 3D", "utf8").toString("base64")}?=`,
    );
  });

  it("refuses a region that is not one", () => {
    expect(() =>
      createScalewayTransport({ ...config, region: "../../v1/secrets" }),
    ).toThrow(/EMAIL_REGION/);
  });
});

// The switch itself, not the transports on either side of it: invert it and
// a deployment goes silent while writing its verification links to the log.
describe("choosing a transport from the environment (#22)", () => {
  const send = () =>
    sendEmail({
      to: "user@example.test",
      locale: "pl",
      template: SAMPLES_BY_KIND.accountVerification,
    });

  beforeEach(() => resetEmailTransport());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetEmailTransport();
    setEmailTransport(logTransport);
  });

  it("keeps a harness on the log even with real credentials present", async () => {
    // The e2e suite registers @platform-lite.test addresses, which cannot
    // resolve; sending those for real would aim hard bounces at a new domain.
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("EMAIL_API_KEY", "secret-key");
    vi.stubEnv("EMAIL_PROJECT_ID", "project-1");
    vi.stubEnv("EMAIL_FROM", "kontakt@dev.example.test");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await send();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("sends for real in a deployed environment", async () => {
    vi.stubEnv("APP_ENV", "dev");
    vi.stubEnv("EMAIL_API_KEY", "secret-key");
    vi.stubEnv("EMAIL_PROJECT_ID", "project-1");
    vi.stubEnv("EMAIL_FROM", "kontakt@dev.example.test");
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await send();

    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("fails loudly, naming the variable, rather than logging the token", async () => {
    // The failure that matters: a half-filled .env in a deployment used to
    // fall back to logTransport, which prints the verification link.
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("EMAIL_API_KEY", "secret-key");
    vi.stubEnv("EMAIL_PROJECT_ID", "");
    vi.stubEnv("EMAIL_FROM", "kontakt@dev.example.test");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(send()).rejects.toThrow(/EMAIL_PROJECT_ID/);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

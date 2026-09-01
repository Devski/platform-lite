import { like } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { sessions, users, verifications } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-db";
import { createAuth } from "./auth";
import {
  createMemoryTransport,
  logTransport,
  renderEmail,
  setEmailTransport,
  type EmailMessage,
} from "./email";

// Integration suite for #10 (account settings: change password and change
// e-mail, A10) driven through auth.handler(Request) — the exact HTTP surface
// production mounts.

const BASE_URL = "http://localhost:3000";
const SECRET = "test-secret-at-least-32-characters-long!";
const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "completely different phrase";
const ONE_HOUR = 60 * 60;
const CONFIRM_URL_RE = /https?:\/\/\S*\/verify-email\?\S+/;

let testDb: TestDb;
let auth: ReturnType<typeof createAuth>;
let delivered: EmailMessage[];
// Unique IP per test: better-auth's in-memory rate-limit store is
// module-level and would otherwise bleed windows between tests.
let ipCounter = 0;
let testIp: string;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  auth = createAuth({ db: testDb.db, baseURL: BASE_URL, secret: SECRET });
  testIp = `198.51.100.${++ipCounter}`;
  const memory = createMemoryTransport();
  delivered = memory.delivered;
  setEmailTransport(memory.transport);
});

afterEach(() => {
  setEmailTransport(logTransport);
});

function post(
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<Response> {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        "x-forwarded-for": testIp,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

/** Register the address and click the verification link from the e-mail. */
async function registerVerified(email: string): Promise<void> {
  const before = delivered.length;
  const signUp = await post("/sign-up/email", {
    name: email.split("@")[0],
    email,
    password: PASSWORD,
  });
  expect(signUp.status).toBe(200);
  const url = delivered[before].body.match(/https?:\/\/\S*\/verify-email\?\S+/);
  const verify = await auth.handler(new Request(url![0]));
  expect([200, 302]).toContain(verify.status);
}

function signIn(email: string, password: string): Promise<Response> {
  return post("/sign-in/email", { email, password });
}

/** "name=value" pair of the session cookie set by the response. */
function sessionCookiePair(response: Response): string {
  const line = response.headers
    .getSetCookie()
    .find((cookie) => cookie.split("=")[0].endsWith("session_token"));
  if (!line) throw new Error("no session cookie on the response");
  return line.split(";")[0];
}

/** Register, verify and sign in; returns the session cookie pair. */
async function signedInUser(email: string): Promise<string> {
  await registerVerified(email);
  const login = await signIn(email, PASSWORD);
  expect(login.status).toBe(200);
  return sessionCookiePair(login);
}

function subjectOf(template: Parameters<typeof renderEmail>[0]): string {
  return renderEmail(template, "pl").subject;
}

function passwordChangedCount(): number {
  return delivered.filter(
    (message) =>
      message.subject === subjectOf({ kind: "passwordChanged", params: {} }),
  ).length;
}

async function emailChangeMarkers(): Promise<{ value: string }[]> {
  return testDb.db
    .select({ value: verifications.value })
    .from(verifications)
    .where(like(verifications.identifier, "email-change-pending:%"));
}

describe("change password (A10)", () => {
  it("changes the password, confirms by e-mail and keeps only this session", async () => {
    const cookie = await signedInUser("switch@example.com");
    await signIn("switch@example.com", PASSWORD); // a second device
    expect(await testDb.db.select().from(sessions)).toHaveLength(2);
    const before = delivered.length;

    const response = await post(
      "/change-password",
      {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
        revokeOtherSessions: true,
      },
      { cookie },
    );
    expect(response.status).toBe(200);

    // The confirmation goes to the account address (A10).
    expect(delivered).toHaveLength(before + 1);
    expect(delivered[before].to).toBe("switch@example.com");
    expect(delivered[before].subject).toBe(
      subjectOf({ kind: "passwordChanged", params: {} }),
    );

    // Every other session is gone; the fresh one from the response works.
    const rows = await testDb.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    const freshCookie = sessionCookiePair(response);
    const who = await auth.handler(
      new Request(`${BASE_URL}/api/auth/get-session`, {
        headers: { "x-forwarded-for": testIp, cookie: freshCookie },
      }),
    );
    expect(((await who.json()) as { user: { email: string } }).user.email).toBe(
      "switch@example.com",
    );

    // Probe from a separate IP: the sign-ins above already used up this
    // test's built-in 3-per-10-s sign-in allowance.
    const probe = { "x-forwarded-for": `203.0.113.${ipCounter}` };
    expect(
      (
        await post(
          "/sign-in/email",
          { email: "switch@example.com", password: PASSWORD },
          probe,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await post(
          "/sign-in/email",
          { email: "switch@example.com", password: NEW_PASSWORD },
          probe,
        )
      ).status,
    ).toBe(200);
  }, 30_000);

  it("rejects a wrong current password and sends nothing", async () => {
    const cookie = await signedInUser("wrong@example.com");
    const before = delivered.length;
    const response = await post(
      "/change-password",
      { currentPassword: "not the password", newPassword: NEW_PASSWORD },
      { cookie },
    );
    expect(response.status).toBe(400);
    expect(delivered).toHaveLength(before);
    expect((await signIn("wrong@example.com", PASSWORD)).status).toBe(200);
  }, 30_000);

  it("enforces the A1 bounds on the new password", async () => {
    const cookie = await signedInUser("bounds@example.com");
    for (const newPassword of ["1234567", "x".repeat(129)]) {
      const response = await post(
        "/change-password",
        { currentPassword: PASSWORD, newPassword },
        { cookie },
      );
      expect(response.status).toBe(400);
    }
    expect(passwordChangedCount()).toBe(0);
  }, 30_000);

  it("requires a session", async () => {
    const response = await post("/change-password", {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(response.status).toBe(401);
  });

  it("sends the confirmation in the locale of the request (A8)", async () => {
    const cookie = await signedInUser("locale@example.com");
    const before = delivered.length;
    await post(
      "/change-password",
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      { cookie, "accept-language": "en-GB,en;q=0.9" },
    );
    expect(delivered[before].subject).toBe(
      renderEmail({ kind: "passwordChanged", params: {} }, "en").subject,
    );
  }, 30_000);

  it("allows at most 10 attempts per hour from one IP", async () => {
    const cookie = await signedInUser("throttle@example.com");
    for (let attempt = 1; attempt <= 10; attempt++) {
      const response = await post(
        "/change-password",
        { currentPassword: "wrong on purpose", newPassword: NEW_PASSWORD },
        { cookie },
      );
      expect(response.status).toBe(400);
    }
    const eleventh = await post(
      "/change-password",
      { currentPassword: "wrong on purpose", newPassword: NEW_PASSWORD },
      { cookie },
    );
    expect(eleventh.status).toBe(429);
    // The window is the full hour, not the built-in 10 seconds.
    expect(Number(eleventh.headers.get("x-retry-after"))).toBeGreaterThan(
      ONE_HOUR - 100,
    );
  }, 60_000);
});

describe("change e-mail (A10)", () => {
  function requestChange(
    cookie: string,
    newEmail: string,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    return post(
      "/change-email",
      { newEmail, callbackURL: "/email-changed" },
      { cookie, ...headers },
    );
  }

  function confirmUrlFrom(message: EmailMessage): string {
    const match = message.body.match(CONFIRM_URL_RE);
    if (!match) throw new Error(`no confirmation URL in: ${message.body}`);
    return match[0];
  }

  /** The confirmation link of the latest request — second-to-last message,
   * because the notice to the old address follows it. */
  function lastChangeConfirmUrl(): string {
    return confirmUrlFrom(delivered.at(-2)!);
  }

  it("sends the confirmation to the new address and the notice to the old one; nothing changes yet", async () => {
    const cookie = await signedInUser("old@example.com");
    const before = delivered.length;

    const response = await requestChange(cookie, "new@example.com");
    expect(response.status).toBe(200);

    // A10 "address change ×2": confirmation link -> new, notice -> old.
    expect(delivered).toHaveLength(before + 2);
    const confirmation = delivered[before];
    expect(confirmation.to).toBe("new@example.com");
    expect(confirmation.subject).toBe(
      subjectOf({ kind: "emailChangeConfirmation", params: { confirmUrl: "x" } }),
    );
    expect(confirmUrlFrom(confirmation)).toBeTruthy();
    const notice = delivered[before + 1];
    expect(notice.to).toBe("old@example.com");
    expect(notice.subject).toBe(
      subjectOf({ kind: "emailChangeNotice", params: { newEmail: "x" } }),
    );
    expect(notice.body).toContain("new@example.com");

    // The pending change is recorded but not in effect (the criterion).
    expect(await emailChangeMarkers()).toEqual([
      { value: "new@example.com" },
    ]);
    const [user] = await testDb.db.select().from(users);
    expect(user.email).toBe("old@example.com");
    expect((await signIn("old@example.com", PASSWORD)).status).toBe(200);
  }, 30_000);

  it("switches the address only when the new-address link is clicked", async () => {
    const cookie = await signedInUser("before@example.com");
    await requestChange(cookie, "after@example.com");

    const click = await auth.handler(
      new Request(lastChangeConfirmUrl(), {
        headers: { cookie, "x-forwarded-for": testIp },
      }),
    );
    expect(click.status).toBe(302);
    expect(click.headers.get("location")).toContain("/email-changed");

    const [user] = await testDb.db.select().from(users);
    expect(user.email).toBe("after@example.com");
    expect(user.emailVerified).toBe(true);
    // The marker is consumed with the change.
    expect(await emailChangeMarkers()).toHaveLength(0);

    // The password stays; only the address moved.
    expect((await signIn("after@example.com", PASSWORD)).status).toBe(200);
    expect((await signIn("before@example.com", PASSWORD)).status).toBe(401);
  }, 30_000);

  it("answers a taken address with a generic 200 and sends nothing", async () => {
    await registerVerified("taken@example.com");
    const cookie = await signedInUser("mine@example.com");
    const before = delivered.length;

    const response = await requestChange(cookie, "taken@example.com");
    expect(response.status).toBe(200);
    expect(delivered).toHaveLength(before);
    expect(await emailChangeMarkers()).toHaveLength(0);
  }, 30_000);

  it("rejects the unchanged address and a missing session", async () => {
    const cookie = await signedInUser("same@example.com");
    expect((await requestChange(cookie, "same@example.com")).status).toBe(400);
    expect(
      (
        await post("/change-email", {
          newEmail: "whoever@example.com",
          callbackURL: "/email-changed",
        })
      ).status,
    ).toBe(401);
  }, 30_000);

  it("a password reset invalidates the pending change (#10 security obligation)", async () => {
    const cookie = await signedInUser("victim@example.com");
    await requestChange(cookie, "attacker@example.com");
    const confirmUrl = lastChangeConfirmUrl();

    // The notice advises a password reset — walk it end to end.
    await post("/request-password-reset", {
      email: "victim@example.com",
      redirectTo: "/reset-password/new",
    });
    const resetUrl = delivered.at(-1)!.body.match(/https?:\/\/\S+/)![0];
    const landing = await auth.handler(new Request(resetUrl));
    const token = new URL(landing.headers.get("location")!).searchParams.get(
      "token",
    );
    expect(
      (await post("/reset-password", { newPassword: NEW_PASSWORD, token }))
        .status,
    ).toBe(200);
    expect(await emailChangeMarkers()).toHaveLength(0);

    // The still-signed change link is now dead and the address unchanged.
    const click = await auth.handler(new Request(confirmUrl));
    expect(click.status).toBe(302);
    expect(click.headers.get("location")).toContain("error=INVALID_TOKEN");
    const [user] = await testDb.db.select().from(users);
    expect(user.email).toBe("victim@example.com");
  }, 30_000);

  it("a newer change request kills the older link", async () => {
    const cookie = await signedInUser("serial@example.com");
    await requestChange(cookie, "first@example.com");
    const firstUrl = lastChangeConfirmUrl();
    await requestChange(cookie, "second@example.com");

    const stale = await auth.handler(new Request(firstUrl));
    expect(stale.headers.get("location")).toContain("error=INVALID_TOKEN");

    const fresh = await auth.handler(
      new Request(lastChangeConfirmUrl()),
    );
    expect(fresh.status).toBe(302);
    expect(fresh.headers.get("location")).not.toContain("error=");
    const [user] = await testDb.db.select().from(users);
    expect(user.email).toBe("second@example.com");
  }, 30_000);

  it("a logged-out click still applies the change and signs the user in (library contract)", async () => {
    const cookie = await signedInUser("mobile@example.com");
    await requestChange(cookie, "desktop@example.com");
    await post("/sign-out", {}, { cookie });

    // Possession of the link is the proof: the click applies the change and
    // opens a session for the account.
    const click = await auth.handler(
      new Request(lastChangeConfirmUrl(), {
        headers: { "x-forwarded-for": testIp },
      }),
    );
    expect(click.status).toBe(302);
    expect(
      click.headers
        .getSetCookie()
        .some((line) => line.split("=")[0].endsWith("session_token")),
    ).toBe(true);
    const [user] = await testDb.db.select().from(users);
    expect(user.email).toBe("desktop@example.com");
  }, 30_000);

  it("allows at most 3 requests per hour from one IP", async () => {
    const cookie = await signedInUser("limit@example.com");
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await requestChange(
        cookie,
        `target-${attempt}@example.com`,
      );
      expect(response.status).toBe(200);
    }
    const fourth = await requestChange(cookie, "target-4@example.com");
    expect(fourth.status).toBe(429);
    expect(Number(fourth.headers.get("x-retry-after"))).toBeGreaterThan(
      ONE_HOUR - 100,
    );
  }, 30_000);

  it("ignores an updateTo token minted outside the change flow (defense in depth)", async () => {
    // No flow of ours mints an updateTo token without the
    // change-email-verification request type — the gate refuses any other.
    const { createEmailVerificationToken } = await import("better-auth/api");
    await registerVerified("legacy@example.com");
    const forged = await createEmailVerificationToken(
      SECRET,
      "legacy@example.com",
      "hijacked@example.com",
      3600,
    );
    const click = await auth.handler(
      new Request(
        `${BASE_URL}/api/auth/verify-email?token=${forged}&callbackURL=/email-changed`,
      ),
    );
    expect(click.status).toBe(302);
    expect(click.headers.get("location")).toContain("error=INVALID_TOKEN");
    const [user] = await testDb.db.select().from(users);
    expect(user.email).toBe("legacy@example.com");
  }, 30_000);
});

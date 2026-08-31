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
import { sessions, verifications } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-db";
import { createAuth } from "./auth";
import {
  createMemoryTransport,
  logTransport,
  renderEmail,
  setEmailTransport,
  type EmailMessage,
} from "./email";

// Integration suite for A3 (password reset: single-use link valid 60 minutes,
// notification after a successful change) driven through auth.handler(Request)
// — the exact HTTP surface production mounts.

const BASE_URL = "http://localhost:3000";
const SECRET = "test-secret-at-least-32-characters-long!";
const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "completely different phrase";
const ONE_HOUR = 60 * 60;
const RESET_URL_RE = /https?:\/\/\S*\/reset-password\/\S+/;

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

function requestReset(
  email: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return post(
    "/request-password-reset",
    { email, redirectTo: "/reset-password/new" },
    headers,
  );
}

function resetUrlFrom(message: EmailMessage): string {
  const match = message.body.match(RESET_URL_RE);
  if (!match) throw new Error(`no reset URL in: ${message.body}`);
  return match[0];
}

/** Follow the mailed link; returns the redirect Location. */
async function followResetLink(url: string): Promise<string> {
  const response = await auth.handler(new Request(url));
  expect(response.status).toBe(302);
  return response.headers.get("location")!;
}

/** Request a reset and walk the mailed link into a usable token. */
async function obtainResetToken(
  email: string,
): Promise<{ url: string; token: string }> {
  await requestReset(email);
  const url = resetUrlFrom(delivered.at(-1)!);
  const location = await followResetLink(url);
  return { url, token: new URL(location).searchParams.get("token")! };
}

describe("requesting a password reset (A3)", () => {
  it("e-mails a single-use link whose token expires in 60 minutes", async () => {
    await registerVerified("reset@example.com");
    const before = delivered.length;

    const response = await requestReset("reset@example.com");
    expect(response.status).toBe(200);

    expect(delivered).toHaveLength(before + 1);
    const message = delivered[before];
    expect(message.to).toBe("reset@example.com");
    expect(message.subject).toBe(
      renderEmail({ kind: "passwordReset", params: { resetUrl: "x" } }, "pl")
        .subject,
    );
    expect(resetUrlFrom(message)).toContain("/api/auth/reset-password/");

    const [row] = await testDb.db
      .select()
      .from(verifications)
      .where(like(verifications.identifier, "reset-password:%"));
    const secondsLeft = (row.expiresAt.getTime() - Date.now()) / 1000;
    expect(secondsLeft).toBeGreaterThan(ONE_HOUR - 60);
    expect(secondsLeft).toBeLessThan(ONE_HOUR + 60);
  }, 15_000);

  it("answers an unknown address exactly like a known one and sends nothing", async () => {
    await registerVerified("known@example.com");
    const before = delivered.length;

    const known = await requestReset("known@example.com");
    const unknown = await requestReset("ghost@example.com");
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await unknown.json()).toEqual(await known.json());

    // Only the known address got a message.
    expect(delivered).toHaveLength(before + 1);
    expect(delivered[before].to).toBe("known@example.com");
  }, 15_000);

  it("sends the e-mail in the locale of the request (A8)", async () => {
    await registerVerified("locale@example.com");
    const before = delivered.length;
    await requestReset("locale@example.com", {
      "accept-language": "en-GB,en;q=0.9",
    });
    expect(delivered[before].subject).toBe(
      renderEmail({ kind: "passwordReset", params: { resetUrl: "x" } }, "en")
        .subject,
    );
  }, 15_000);

  it("allows at most 3 requests per hour from one IP", async () => {
    await registerVerified("throttle@example.com");
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await requestReset("throttle@example.com");
      expect(response.status).toBe(200);
    }
    const fourth = await requestReset("throttle@example.com");
    expect(fourth.status).toBe(429);
    // The window is the full hour, not the built-in 60 seconds.
    expect(Number(fourth.headers.get("x-retry-after"))).toBeGreaterThan(
      ONE_HOUR - 100,
    );
  }, 20_000);
});

describe("completing the reset (A3)", () => {
  it("resets via the mailed link, notifies the address and revokes sessions", async () => {
    await registerVerified("happy@example.com");
    expect((await signIn("happy@example.com", PASSWORD)).status).toBe(200);
    expect(await testDb.db.select().from(sessions)).toHaveLength(1);

    await requestReset("happy@example.com");
    const location = await followResetLink(resetUrlFrom(delivered.at(-1)!));
    const redirect = new URL(location);
    expect(redirect.pathname).toBe("/reset-password/new");
    const token = redirect.searchParams.get("token");
    expect(token).toBeTruthy();

    const before = delivered.length;
    const response = await post("/reset-password", {
      newPassword: NEW_PASSWORD,
      token,
    });
    expect(response.status).toBe(200);

    // The notification goes to the account address (A3).
    expect(delivered).toHaveLength(before + 1);
    const notice = delivered[before];
    expect(notice.to).toBe("happy@example.com");
    expect(notice.subject).toBe(
      renderEmail({ kind: "passwordChanged", params: {} }, "pl").subject,
    );

    // Every live session is gone; only the new password works.
    expect(await testDb.db.select().from(sessions)).toHaveLength(0);
    expect((await signIn("happy@example.com", PASSWORD)).status).toBe(401);
    expect((await signIn("happy@example.com", NEW_PASSWORD)).status).toBe(200);
  }, 20_000);

  it("rejects a reused link on both the callback and the submit", async () => {
    await registerVerified("reuse@example.com");
    const { url, token } = await obtainResetToken("reuse@example.com");

    expect(
      (await post("/reset-password", { newPassword: NEW_PASSWORD, token }))
        .status,
    ).toBe(200);
    const after = delivered.length;

    // The link is single-use: the same token opens nothing and resets nothing.
    expect(await followResetLink(url)).toContain("error=INVALID_TOKEN");
    const reuse = await post("/reset-password", {
      newPassword: "yet another passphrase",
      token,
    });
    expect(reuse.status).toBe(400);
    expect(delivered).toHaveLength(after);
    expect((await signIn("reuse@example.com", NEW_PASSWORD)).status).toBe(200);
  }, 20_000);

  it("rejects an expired link and leaves the password unchanged", async () => {
    await registerVerified("expired@example.com");
    const { url, token } = await obtainResetToken("expired@example.com");

    await testDb.db
      .update(verifications)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(like(verifications.identifier, "reset-password:%"));

    expect(await followResetLink(url)).toContain("error=INVALID_TOKEN");
    const submit = await post("/reset-password", {
      newPassword: NEW_PASSWORD,
      token,
    });
    expect(submit.status).toBe(400);

    expect((await signIn("expired@example.com", PASSWORD)).status).toBe(200);
    expect(
      delivered.some(
        (message) =>
          message.subject ===
          renderEmail({ kind: "passwordChanged", params: {} }, "pl").subject,
      ),
    ).toBe(false);
  }, 20_000);

  it("enforces the A1 bounds on the new password without burning the token", async () => {
    await registerVerified("bounds@example.com");
    const { token } = await obtainResetToken("bounds@example.com");

    const tooShort = await post("/reset-password", {
      newPassword: "1234567",
      token,
    });
    expect(tooShort.status).toBe(400);
    const tooLong = await post("/reset-password", {
      newPassword: "x".repeat(129),
      token,
    });
    expect(tooLong.status).toBe(400);

    // Bounds are checked before the token is consumed — it still works.
    const valid = await post("/reset-password", {
      newPassword: "aaaaaaaa",
      token,
    });
    expect(valid.status).toBe(200);
  }, 20_000);
});

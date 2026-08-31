import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { sessions } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-db";
import { createAuth } from "./auth";
import {
  createMemoryTransport,
  logTransport,
  setEmailTransport,
  type EmailMessage,
} from "./email";

// Integration suite for A2 (login, logout, 30-day renewable sessions) driven
// through auth.handler(Request) — the exact HTTP surface production mounts.

const BASE_URL = "http://localhost:3000";
const HTTPS_URL = "https://app.example.com";
const SECRET = "test-secret-at-least-32-characters-long!";
const PASSWORD = "correct horse battery staple";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

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
  instance: ReturnType<typeof createAuth>,
  baseURL: string,
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<Response> {
  return instance.handler(
    new Request(`${baseURL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseURL,
        "x-forwarded-for": testIp,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

/** Register the address and click the verification link from the e-mail. */
async function registerVerified(
  email: string,
  instance = auth,
  baseURL = BASE_URL,
): Promise<void> {
  const before = delivered.length;
  const signUp = await post(instance, baseURL, "/sign-up/email", {
    name: email.split("@")[0],
    email,
    password: PASSWORD,
  });
  expect(signUp.status).toBe(200);
  const url = delivered[before].body.match(/https?:\/\/\S*\/verify-email\?\S+/);
  const verify = await instance.handler(new Request(url![0]));
  expect([200, 302]).toContain(verify.status);
}

function signIn(
  email: string,
  password = PASSWORD,
  instance = auth,
  baseURL = BASE_URL,
): Promise<Response> {
  return post(instance, baseURL, "/sign-in/email", { email, password });
}

/** The session_token Set-Cookie line (any name suffix), or null. */
function sessionSetCookie(response: Response): string | null {
  return (
    response.headers
      .getSetCookie()
      .find((cookie) => cookie.split("=")[0].endsWith("session_token")) ?? null
  );
}

/** "name=value" pair of the session cookie, ready for a cookie header. */
function sessionCookiePair(response: Response): string {
  const line = sessionSetCookie(response);
  if (!line) throw new Error("no session cookie on the response");
  const [nameAndValue] = line.split(";");
  return nameAndValue;
}

function getSession(
  cookie: string | null,
  instance = auth,
  baseURL = BASE_URL,
): Promise<Response> {
  return instance.handler(
    new Request(`${baseURL}/api/auth/get-session`, {
      headers: {
        "x-forwarded-for": testIp,
        ...(cookie ? { cookie } : {}),
      },
    }),
  );
}

describe("login (A2)", () => {
  it("signs a verified account in and sets the 30-day lax httpOnly cookie", async () => {
    await registerVerified("login@example.com");
    const response = await signIn("login@example.com");
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { token: string };
    expect(payload.token).toBeTruthy();

    const cookie = sessionSetCookie(response)!;
    expect(cookie.startsWith("better-auth.session_token=")).toBe(true);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${THIRTY_DAYS}`);
    // http base URL in dev — Secure appears only on https (asserted below).
    expect(cookie).not.toContain("Secure");

    const rows = await testDb.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(
      Date.now() + (THIRTY_DAYS - 60) * 1000,
    );
  });

  it("marks the cookie Secure (and __Secure- prefixed) on an https base URL", async () => {
    const httpsAuth = createAuth({
      db: testDb.db,
      baseURL: HTTPS_URL,
      secret: SECRET,
    });
    await registerVerified("secure@example.com", httpsAuth, HTTPS_URL);
    const response = await signIn(
      "secure@example.com",
      PASSWORD,
      httpsAuth,
      HTTPS_URL,
    );
    expect(response.status).toBe(200);
    const cookie = sessionSetCookie(response)!;
    expect(cookie.startsWith("__Secure-better-auth.session_token=")).toBe(true);
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("answers wrong password and unknown e-mail identically (no enumeration)", async () => {
    await registerVerified("known@example.com");
    const wrongPassword = await signIn("known@example.com", "not-the-password");
    const unknownEmail = await signIn("ghost@example.com", "not-the-password");

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
  });

  it("accepts a case-variant e-mail on login", async () => {
    await registerVerified("case-login@example.com");
    const response = await signIn("Case-Login@Example.COM");
    expect(response.status).toBe(200);
  });

  it("refuses an unverified account with 403 and sends no e-mail (A1/A2)", async () => {
    await post(auth, BASE_URL, "/sign-up/email", {
      name: "unverified",
      email: "unverified@example.com",
      password: PASSWORD,
    });
    const before = delivered.length;

    const response = await signIn("unverified@example.com");
    expect(response.status).toBe(403);
    const payload = (await response.json()) as { code: string };
    expect(payload.code).toBe("EMAIL_NOT_VERIFIED");
    // sendOnSignIn stays unset on purpose: recovery is the explicit,
    // rate-limited resend endpoint, not an invisible send on every attempt.
    expect(delivered).toHaveLength(before);

    const rows = await testDb.db.select().from(sessions);
    expect(rows).toHaveLength(0);
  });

  it("rate limits login attempts from one address (A2)", async () => {
    await registerVerified("throttle@example.com");
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await signIn("throttle@example.com", "wrong-password");
      expect(response.status).toBe(401);
    }
    const fourth = await signIn("throttle@example.com", "wrong-password");
    expect(fourth.status).toBe(429);
  }, 15_000);
});

describe("logout (A2)", () => {
  it("deletes the session row and expires the cookie", async () => {
    await registerVerified("logout@example.com");
    const login = await signIn("logout@example.com");
    const cookiePair = sessionCookiePair(login);

    const response = await post(
      auth,
      BASE_URL,
      "/sign-out",
      {},
      { cookie: cookiePair },
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { success: boolean }).success).toBe(
      true,
    );

    const clearing = sessionSetCookie(response)!;
    expect(clearing).toContain("Max-Age=0");

    const rows = await testDb.db.select().from(sessions);
    expect(rows).toHaveLength(0);
  });

  it("is idempotent: signing out without a session still succeeds", async () => {
    const response = await post(auth, BASE_URL, "/sign-out", {});
    expect(response.status).toBe(200);
  });
});

describe("session lifecycle (A2: 30 days, renewable)", () => {
  it("returns null for a request without a session cookie", async () => {
    const response = await getSession(null);
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it("returns the session and user for a valid cookie", async () => {
    await registerVerified("whoami@example.com");
    const login = await signIn("whoami@example.com");
    const response = await getSession(sessionCookiePair(login));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      user: { email: string };
      session: { token: string };
    };
    expect(payload.user.email).toBe("whoami@example.com");
    expect(payload.session.token).toBeTruthy();
  });

  it("renews the session past updateAge: expiresAt slides, cookie re-issued", async () => {
    // Seconds-scale window so the test can cross updateAge in real time.
    const shortAuth = createAuth({
      db: testDb.db,
      baseURL: BASE_URL,
      secret: SECRET,
      session: { expiresIn: 8, updateAge: 2 },
    });
    await registerVerified("renew@example.com", shortAuth);
    const login = await signIn("renew@example.com", PASSWORD, shortAuth);
    const cookiePair = sessionCookiePair(login);
    const [{ expiresAt: initialExpiry }] = await testDb.db
      .select()
      .from(sessions);

    // Inside updateAge: no write happens.
    const early = await getSession(cookiePair, shortAuth);
    expect(sessionSetCookie(early)).toBeNull();
    const [{ expiresAt: unchanged }] = await testDb.db.select().from(sessions);
    expect(unchanged.getTime()).toBe(initialExpiry.getTime());

    await new Promise((resolve) => setTimeout(resolve, 2_300));

    const renewed = await getSession(cookiePair, shortAuth);
    expect(renewed.status).toBe(200);
    const [{ expiresAt: extended }] = await testDb.db.select().from(sessions);
    expect(extended.getTime()).toBeGreaterThan(initialExpiry.getTime());
    // The refreshed cookie carries the full window again.
    const reissued = sessionSetCookie(renewed)!;
    expect(reissued).toContain("Max-Age=8");
  }, 15_000);

  it("treats an expired session as gone and clears it", async () => {
    const shortAuth = createAuth({
      db: testDb.db,
      baseURL: BASE_URL,
      secret: SECRET,
      session: { expiresIn: 1, updateAge: 1 },
    });
    await registerVerified("expired@example.com", shortAuth);
    const login = await signIn("expired@example.com", PASSWORD, shortAuth);
    const cookiePair = sessionCookiePair(login);

    await new Promise((resolve) => setTimeout(resolve, 1_200));

    const response = await getSession(cookiePair, shortAuth);
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    // The reset database held exactly this one session; expiry removed it.
    const rows = await testDb.db.select().from(sessions);
    expect(rows).toHaveLength(0);
  }, 15_000);
});

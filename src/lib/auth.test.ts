import { createEmailVerificationToken } from "better-auth/api";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { accounts, sessions, users } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-db";
import { createAuth } from "./auth";
import {
  createMemoryTransport,
  logTransport,
  renderEmail,
  setEmailTransport,
  type EmailMessage,
} from "./email";

// Integration suite for A1 (SPEC.md §1) driven through auth.handler(Request)
// — the same HTTP surface the route handler mounts, so rate limiting, body
// parsing and cookies behave exactly as in production.

const BASE_URL = "http://localhost:3000";
const SECRET = "test-secret-at-least-32-characters-long!";
const PASSWORD = "correct horse battery staple";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VERIFY_URL_RE = /https?:\/\/\S*\/verify-email\?\S+/;

let testDb: TestDb;
let auth: ReturnType<typeof createAuth>;
let delivered: EmailMessage[];
// The in-memory rate-limit store is module-level inside better-auth, so it
// survives across auth instances. Keys include the client IP — a unique IP
// per test keeps windows from bleeding between tests.
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

function signUp(
  email: string,
  headers: Record<string, string> = {},
  password: string = PASSWORD,
): Promise<Response> {
  return post(
    "/sign-up/email",
    // Display identity arrives with profiles (#14); Better Auth's required
    // name field is seeded from the address, same as src/lib/auth.ts hook-free
    // clients would send.
    { name: email.split("@")[0], email, password, callbackURL: "/welcome" },
    headers,
  );
}

function verifyUrlFrom(message: EmailMessage): string {
  const match = message.body.match(VERIFY_URL_RE);
  if (!match) throw new Error(`no verification URL in: ${message.body}`);
  return match[0];
}

describe("sign-up (A1)", () => {
  it("creates an inactive account with a DB-generated uuid and no session", async () => {
    const response = await signUp("new@example.com");
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { token: string | null };
    // requireEmailVerification: no session until the link is clicked.
    expect(payload.token).toBeNull();

    const [user] = await testDb.db.select().from(users);
    expect(user.id).toMatch(UUID_RE);
    expect(user.email).toBe("new@example.com");
    expect(user.emailVerified).toBe(false);

    const sessionRows = await testDb.db.select().from(sessions);
    expect(sessionRows).toHaveLength(0);
  });

  it("stores only a password hash, under the credential provider (A2)", async () => {
    await signUp("hash@example.com");
    const [account] = await testDb.db.select().from(accounts);
    expect(account.providerId).toBe("credential");
    expect(account.issuer).toBe("local:credential");
    expect(account.password).toBeTruthy();
    expect(account.password).not.toContain(PASSWORD);
    // scrypt output: hex salt and key separated by a colon.
    expect(account.password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it("lowercases the e-mail before storing it", async () => {
    await signUp("MiXeD@Example.COM");
    const [user] = await testDb.db.select().from(users);
    expect(user.email).toBe("mixed@example.com");
  });

  it("sends the verification e-mail with a 24-hour token (A1)", async () => {
    await signUp("verify@example.com");
    expect(delivered).toHaveLength(1);
    expect(delivered[0].to).toBe("verify@example.com");

    const url = new URL(verifyUrlFrom(delivered[0]));
    const token = url.searchParams.get("token");
    expect(token).toBeTruthy();
    const claims = JSON.parse(
      Buffer.from(token!.split(".")[1], "base64url").toString(),
    ) as { exp: number; iat: number };
    expect(claims.exp - claims.iat).toBe(60 * 60 * 24);
  });

  it("sends the e-mail in Polish by default and follows Accept-Language/cookie (A8)", async () => {
    await signUp("pl@example.com");
    expect(delivered[0].subject).toBe(
      renderEmail(
        { kind: "accountVerification", params: { verifyUrl: "x" } },
        "pl",
      ).subject,
    );

    await signUp("en@example.com", { "accept-language": "en-GB,en;q=0.9" });
    expect(delivered[1].subject).toBe(
      renderEmail(
        { kind: "accountVerification", params: { verifyUrl: "x" } },
        "en",
      ).subject,
    );

    await signUp("cookie@example.com", {
      "accept-language": "pl",
      cookie: "NEXT_LOCALE=en",
    });
    expect(delivered[2].subject).toBe(delivered[1].subject);
  });

  it("answers a duplicate sign-up generically and sends nothing (enumeration protection)", async () => {
    await signUp("taken@example.com");
    const [original] = await testDb.db.select().from(users);

    for (const variant of ["taken@example.com", "TAKEN@example.com"]) {
      const response = await signUp(variant);
      // Indistinguishable from a fresh sign-up: 200 with a user object...
      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        token: string | null;
        user: { id: string };
      };
      expect(payload.token).toBeNull();
      expect(payload.user.id).not.toBe(original.id);
    }

    // ...but no second account and no second e-mail.
    const rows = await testDb.db.select().from(users);
    expect(rows).toHaveLength(1);
    expect(delivered).toHaveLength(1);
  });

  it("rejects passwords outside 8-128 characters, with no composition rules (A1)", async () => {
    expect((await signUp("short@example.com", {}, "1234567")).status).toBe(400);
    expect((await signUp("long@example.com", {}, "x".repeat(129))).status).toBe(
      400,
    );
    // 8 characters of anything is enough — no composition rules.
    expect((await signUp("edge@example.com", {}, "aaaaaaaa")).status).toBe(200);
  });

  it("rate limits sign-up attempts from one address (A1)", async () => {
    const headers = { "x-forwarded-for": "203.0.113.7" };
    for (const n of [1, 2, 3]) {
      const response = await signUp(`burst-${n}@example.com`, headers);
      expect(response.status).toBe(200);
    }
    const fourth = await signUp("burst-4@example.com", headers);
    expect(fourth.status).toBe(429);
    expect(fourth.headers.get("x-retry-after")).toBeTruthy();
  }, 15_000);
});

describe("e-mail verification (A1)", () => {
  it("activates the account when the link is clicked and redirects to callbackURL", async () => {
    await signUp("activate@example.com");
    const response = await auth.handler(
      new Request(verifyUrlFrom(delivered[0])),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/welcome");

    const [user] = await testDb.db
      .select()
      .from(users)
      .where(eq(users.email, "activate@example.com"));
    expect(user.emailVerified).toBe(true);
  });

  it("rejects an expired token and keeps the account inactive", async () => {
    await signUp("expired@example.com");
    const expired = await createEmailVerificationToken(
      SECRET,
      "expired@example.com",
      undefined,
      -10,
    );
    const response = await auth.handler(
      new Request(
        `${BASE_URL}/api/auth/verify-email?token=${expired}&callbackURL=/welcome`,
      ),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("error=TOKEN_EXPIRED");

    const [user] = await testDb.db.select().from(users);
    expect(user.emailVerified).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    await signUp("forged@example.com");
    const forged = await createEmailVerificationToken(
      "another-secret-that-is-32-characters!!",
      "forged@example.com",
      undefined,
      3600,
    );
    const response = await auth.handler(
      new Request(
        `${BASE_URL}/api/auth/verify-email?token=${forged}&callbackURL=/welcome`,
      ),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("error=INVALID_TOKEN");
  });
});

describe("resending the verification e-mail (A1)", () => {
  it("resends with the re-verification template (A10)", async () => {
    await signUp("resend@example.com");
    const response = await post("/send-verification-email", {
      email: "resend@example.com",
      callbackURL: "/welcome",
    });
    expect(response.status).toBe(200);
    expect(delivered).toHaveLength(2);
    expect(delivered[1].subject).toBe(
      renderEmail(
        { kind: "accountReverification", params: { verifyUrl: "x" } },
        "pl",
      ).subject,
    );
    expect(verifyUrlFrom(delivered[1])).toBeTruthy();
  }, 15_000);

  it("answers 200 for an unknown address but sends nothing (enumeration protection)", async () => {
    const response = await post("/send-verification-email", {
      email: "nobody@example.com",
    });
    expect(response.status).toBe(200);
    expect(delivered).toHaveLength(0);
  }, 15_000);

  it("allows at most 3 resends per hour (A1)", async () => {
    await signUp("limit@example.com");
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await post("/send-verification-email", {
        email: "limit@example.com",
      });
      expect(response.status).toBe(200);
    }
    const fourth = await post("/send-verification-email", {
      email: "limit@example.com",
    });
    expect(fourth.status).toBe(429);
    // 3 accepted resends went out (plus the sign-up message).
    expect(delivered).toHaveLength(4);
  }, 20_000);
});

describe("getAuth environment wiring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("builds a memoized instance from DATABASE_URL, APP_URL and AUTH_SECRET", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:x@localhost:5432/x");
    vi.stubEnv("APP_URL", BASE_URL);
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.resetModules();
    const { getAuth } = await import("./auth");
    const first = getAuth();
    expect(typeof first.handler).toBe("function");
    expect(getAuth()).toBe(first);
  });

  it.each(["APP_URL", "AUTH_SECRET", "DATABASE_URL"])(
    "fails loudly when %s is missing",
    async (name) => {
      vi.stubEnv("DATABASE_URL", "postgresql://postgres:x@localhost:5432/x");
      vi.stubEnv("APP_URL", BASE_URL);
      vi.stubEnv("AUTH_SECRET", SECRET);
      vi.stubEnv(name, "");
      vi.resetModules();
      const { getAuth } = await import("./auth");
      expect(() => getAuth()).toThrow(name);
    },
  );

  it("refuses a non-https APP_URL in production (A2: Secure cookie)", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:x@localhost:5432/x");
    vi.stubEnv("APP_URL", "http://plaintext.example.com");
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { getAuth } = await import("./auth");
    expect(() => getAuth()).toThrow(/https/);
  });
});

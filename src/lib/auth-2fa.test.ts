import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { twoFactors, users } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-db";
import { createAuth } from "./auth";
import {
  createMemoryTransport,
  logTransport,
  renderEmail,
  setEmailTransport,
  type EmailMessage,
} from "./email";

// Integration suite for #29 (two-factor authentication) driven through
// auth.handler(Request). Both methods per the 01.09.2026 decision: e-mail OTP
// as the easy default, TOTP (authenticator app) + backup codes as the stronger
// option. Every /two-factor/* and /sign-in call uses a FRESH client IP so the
// built-in 3-per-10-s throttle never interferes — cookie continuity, not IP,
// carries the session and the pending challenge.

const BASE_URL = "http://localhost:3000";
const SECRET = "test-secret-at-least-32-characters-long!";
const PASSWORD = "correct horse battery staple";

let testDb: TestDb;
let auth: ReturnType<typeof createAuth>;
let delivered: EmailMessage[];
let ipCounter = 0;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  auth = createAuth({ db: testDb.db, baseURL: BASE_URL, secret: SECRET });
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
  cookie?: string,
): Promise<Response> {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        // Fresh IP per call: dodge the plugin's 3-per-10-s /two-factor limit.
        "x-forwarded-for": `198.51.100.${++ipCounter % 250}`,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

/** All Set-Cookie name=value pairs joined for a following request's header. */
function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .filter((pair) => !pair.endsWith("=")) // drop cleared cookies (Max-Age=0)
    .join("; ");
}

async function registerVerified(email: string): Promise<void> {
  const before = delivered.length;
  const signUp = await post("/sign-up/email", {
    name: email.split("@")[0],
    email,
    password: PASSWORD,
  });
  expect(signUp.status).toBe(200);
  const url = delivered[before].body.match(/https?:\/\/\S*\/verify-email\?\S+/);
  await auth.handler(new Request(url![0]));
}

/** Register, verify and sign in; returns the session cookie header. */
async function signedIn(email: string): Promise<string> {
  await registerVerified(email);
  const login = await post("/sign-in/email", { email, password: PASSWORD });
  expect(login.status).toBe(200);
  return cookiesFrom(login);
}

function otpCodeFrom(message: EmailMessage): string {
  const match = message.body.match(/\b(\d{6})\b/);
  if (!match) throw new Error(`no 6-digit code in: ${message.body}`);
  return match[1];
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(input: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of input.replace(/=+$/, "").toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(ch);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/** The current TOTP code for the secret carried in an enrollment URI. */
async function totpCodeFor(totpURI: string): Promise<string> {
  const encoded = new URL(totpURI).searchParams.get("secret");
  if (!encoded) throw new Error(`no secret in TOTP URI: ${totpURI}`);
  const secret = String.fromCharCode(...base32Decode(encoded));
  const result = (await auth.api.generateTOTP({ body: { secret } })) as {
    code: string;
  };
  return result.code;
}

async function twoFactorRow(email: string) {
  const [user] = await testDb.db
    .select()
    .from(users)
    .where(eq(users.email, email));
  const [row] = await testDb.db.select().from(twoFactors);
  return { user, row };
}

describe("e-mail OTP as the default second factor (#29)", () => {
  it("enrolls instantly, then a login needs a code mailed to the account", async () => {
    const cookie = await signedIn("otp@example.com");

    const enable = await post(
      "/two-factor/enable",
      { password: PASSWORD, method: "otp" },
      cookie,
    );
    expect(enable.status).toBe(200);
    expect((await enable.json()).method).toBe("otp");
    expect((await twoFactorRow("otp@example.com")).user.twoFactorEnabled).toBe(
      true,
    );

    // A fresh sign-in yields NO session — only a 2FA redirect signal.
    const login = await post("/sign-in/email", {
      email: "otp@example.com",
      password: PASSWORD,
    });
    const payload = (await login.json()) as {
      twoFactorRedirect?: boolean;
      twoFactorMethods?: string[];
      token?: string;
    };
    expect(payload.twoFactorRedirect).toBe(true);
    expect(payload.twoFactorMethods).toContain("otp");
    expect(payload.token).toBeUndefined();
    const challengeCookie = cookiesFrom(login);

    const before = delivered.length;
    const send = await post("/two-factor/send-otp", {}, challengeCookie);
    expect(send.status).toBe(200);
    expect(delivered).toHaveLength(before + 1);
    expect(delivered[before].to).toBe("otp@example.com");
    expect(delivered[before].subject).toBe(
      renderEmail({ kind: "twoFactorCode", params: { code: "x" } }, "pl")
        .subject,
    );
    const code = otpCodeFrom(delivered[before]);

    const verify = await post(
      "/two-factor/verify-otp",
      { code },
      challengeCookie,
    );
    expect(verify.status).toBe(200);
    expect((await verify.json()).token).toBeTruthy();
  }, 30_000);

  it("rejects a wrong code and counts the failure, issuing no session", async () => {
    const cookie = await signedIn("wrong@example.com");
    const enable = await post(
      "/two-factor/enable",
      { password: PASSWORD, method: "otp" },
      cookie,
    );
    expect(enable.status).toBe(200);
    const login = await post("/sign-in/email", {
      email: "wrong@example.com",
      password: PASSWORD,
    });
    expect((await login.clone().json()).twoFactorRedirect).toBe(true);
    const challengeCookie = cookiesFrom(login);
    expect((await post("/two-factor/send-otp", {}, challengeCookie)).status).toBe(
      200,
    );

    const verify = await post(
      "/two-factor/verify-otp",
      { code: "000000" },
      challengeCookie,
    );
    // A wrong code is UNAUTHORIZED (the plugin's `invalid` throws 401) and
    // issues no session token.
    expect(verify.status).toBe(401);
    expect((await verify.json()).token).toBeUndefined();
    // E-mail OTP enrollment is row-less — the flag on users is the whole
    // record; only TOTP stores a secret in two_factors.
    expect(await testDb.db.select().from(twoFactors)).toHaveLength(0);
  }, 30_000);
});

describe("TOTP as the optional stronger factor (#29)", () => {
  it("enrolls with a QR secret + backup codes, confirms, then challenges on login", async () => {
    const cookie = await signedIn("totp@example.com");

    const enable = await post(
      "/two-factor/enable",
      { password: PASSWORD, method: "totp" },
      cookie,
    );
    expect(enable.status).toBe(200);
    const enrollment = (await enable.json()) as {
      method: string;
      totpURI: string;
      backupCodes: string[];
    };
    expect(enrollment.method).toBe("totp");
    expect(enrollment.totpURI).toContain("otpauth://totp/");
    expect(enrollment.backupCodes.length).toBeGreaterThan(0);
    // Not active until a code confirms the authenticator is set up.
    expect((await twoFactorRow("totp@example.com")).user.twoFactorEnabled).toBe(
      false,
    );

    const confirm = await post(
      "/two-factor/verify-totp",
      { code: await totpCodeFor(enrollment.totpURI) },
      cookie,
    );
    expect(confirm.status).toBe(200);
    expect((await twoFactorRow("totp@example.com")).user.twoFactorEnabled).toBe(
      true,
    );

    const login = await post("/sign-in/email", {
      email: "totp@example.com",
      password: PASSWORD,
    });
    const payload = (await login.json()) as { twoFactorMethods?: string[] };
    expect(payload.twoFactorMethods).toContain("totp");
    const challengeCookie = cookiesFrom(login);

    const verify = await post(
      "/two-factor/verify-totp",
      { code: await totpCodeFor(enrollment.totpURI) },
      challengeCookie,
    );
    expect(verify.status).toBe(200);
    expect((await verify.json()).token).toBeTruthy();
  }, 30_000);

  it("lets a backup code stand in for the authenticator, once", async () => {
    const cookie = await signedIn("backup@example.com");
    const enable = await post(
      "/two-factor/enable",
      { password: PASSWORD, method: "totp" },
      cookie,
    );
    const enrollment = (await enable.json()) as {
      totpURI: string;
      backupCodes: string[];
    };
    await post(
      "/two-factor/verify-totp",
      { code: await totpCodeFor(enrollment.totpURI) },
      cookie,
    );
    const backupCode = enrollment.backupCodes[0];

    const login = await post("/sign-in/email", {
      email: "backup@example.com",
      password: PASSWORD,
    });
    const verify = await post(
      "/two-factor/verify-backup-code",
      { code: backupCode },
      cookiesFrom(login),
    );
    expect(verify.status).toBe(200);
    expect((await verify.json()).token).toBeTruthy();

    // Single-use: the same code fails on the next login.
    const login2 = await post("/sign-in/email", {
      email: "backup@example.com",
      password: PASSWORD,
    });
    const reuse = await post(
      "/two-factor/verify-backup-code",
      { code: backupCode },
      cookiesFrom(login2),
    );
    // A spent backup code is rejected as UNAUTHORIZED, like any wrong code.
    expect(reuse.status).toBe(401);
  }, 30_000);
});

describe("managing and bypassing 2FA (#29)", () => {
  it("disabling clears the record and restores plain password login", async () => {
    const cookie = await signedIn("off@example.com");
    // enable(otp) rotates the session (deletes the old, sets a new cookie), so
    // the disable call must carry the fresh cookie from the enable response.
    const enable = await post(
      "/two-factor/enable",
      { password: PASSWORD, method: "otp" },
      cookie,
    );
    const enabledCookie = cookiesFrom(enable);

    const disable = await post(
      "/two-factor/disable",
      { password: PASSWORD },
      enabledCookie,
    );
    expect(disable.status).toBe(200);
    const { user } = await twoFactorRow("off@example.com");
    expect(user.twoFactorEnabled).toBe(false);
    expect(await testDb.db.select().from(twoFactors)).toHaveLength(0);

    const login = await post("/sign-in/email", {
      email: "off@example.com",
      password: PASSWORD,
    });
    const payload = (await login.json()) as {
      twoFactorRedirect?: boolean;
      token?: string;
    };
    expect(payload.twoFactorRedirect).toBeUndefined();
    expect(payload.token).toBeTruthy();
  }, 30_000);

  it("enabling requires the current password", async () => {
    const cookie = await signedIn("guard@example.com");
    const bad = await post(
      "/two-factor/enable",
      { password: "not the password", method: "otp" },
      cookie,
    );
    expect(bad.status).toBe(400);
    expect((await twoFactorRow("guard@example.com")).user.twoFactorEnabled).toBe(
      false,
    );
  }, 30_000);

  it("an account without 2FA signs in straight to a session", async () => {
    const cookie = await signedIn("plain@example.com");
    // signedIn already returned a real session cookie — assert it authenticates.
    const who = await auth.handler(
      new Request(`${BASE_URL}/api/auth/get-session`, {
        headers: { cookie, "x-forwarded-for": `203.0.113.${++ipCounter % 250}` },
      }),
    );
    expect(who.status).toBe(200);
    expect(((await who.json()) as { user: { email: string } }).user.email).toBe(
      "plain@example.com",
    );
  }, 30_000);
});

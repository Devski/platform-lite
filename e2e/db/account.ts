import { randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { waitForEmailLink } from "./email-log";

// Identities and the A1 leg every DB-backed journey starts from.
//
// The database may be a long-lived dev database (SPEC.md §8), so a run never
// truncates anything and never assumes an empty database: every run invents
// its own address and handle. The accounts it leaves behind are inert — they
// belong to nobody and hold no files.

export interface Identity {
  email: string;
  password: string;
  /** A5-valid: 3-30 chars, lowercase letters, digits and dashes. */
  handle: string;
  displayName: string;
}

export function newIdentity(): Identity {
  const suffix = randomBytes(5).toString("hex");
  return {
    // .test is reserved for exactly this (RFC 2606) — it can never resolve to
    // a real mailbox, whatever transport a future environment configures.
    email: `e2e-${suffix}@platform-lite.test`,
    password: `e2e-passphrase-${suffix}`,
    handle: `e2e-${suffix}`,
    displayName: `E2E Studio ${suffix}`,
  };
}

/**
 * A1 through the real UI: fill the sign-up form, read the verification link
 * out of the dev mailbox, click it, and land on the "account active" page.
 * The account has no session yet — Better Auth does not sign a user in on
 * verification, so every caller logs in afterwards.
 */
export async function registerAndVerify(
  page: Page,
  identity: Identity,
): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Adres e-mail").fill(identity.email);
  await page.getByLabel("Hasło").fill(identity.password);
  await page.getByRole("button", { name: "Zarejestruj się" }).click();

  // The form only swaps to this once the server accepted the sign-up, which
  // is also when the verification message has been delivered.
  await expect(
    page.getByRole("heading", { name: "Sprawdź skrzynkę" }),
  ).toBeVisible();

  const verifyUrl = await waitForEmailLink({
    to: identity.email,
    linkPattern: /\/api\/auth\/verify-email\?token=/,
    what: "account verification",
  });

  // A forged link first, so the success below means something. The success
  // heading renders for ANY visit without an ?error parameter —
  // e2e/register.spec.ts reaches it with no token at all — so on its own it
  // says only that the redirect carried no error. Breaking the signature is
  // what makes this step load-bearing: the endpoint has to tell a real token
  // from a forged one, which src/lib/auth.test.ts pins down against the
  // database and this walks through the browser.
  //
  // Not by replaying the real link, which was the first thing tried here:
  // Better Auth's verification token is a signed JWT, so it carries no
  // server-side state and keeps working for its whole 24 hours. CI proved that
  // on 03.09.2026 — a second visit renders "Konto aktywne" again.
  // The FIRST character of the signature, not the last one. The signature is
  // 32 bytes in 43 base64url characters, so the final character carries only
  // four significant bits and its low two are always zero — swapping it lands
  // on a different string that decodes to the same bytes about one time in
  // sixteen, and the server accepts the "forged" link. Measured here on
  // 03.09.2026: 116 of 2000 tokens accepted that way, none when the leading
  // character of the signature is changed instead.
  const tampered = new URL(verifyUrl);
  const [header, payload, signature] = (
    tampered.searchParams.get("token") ?? ""
  ).split(".");
  tampered.searchParams.set(
    "token",
    `${header}.${payload}.${(signature?.[0] === "a" ? "b" : "a") + (signature ?? "").slice(1)}`,
  );
  await page.goto(tampered.toString());
  // The page renders one heading for every code except TOKEN_EXPIRED, so the
  // heading alone would not say which branch answered; the query names it.
  await expect(page).toHaveURL(/[?&]error=INVALID_TOKEN\b/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Nieprawidłowy link" }),
  ).toBeVisible();

  // The real one activates the account, and leaves the browser on the page the
  // journey continues from.
  await page.goto(verifyUrl);
  await expect(
    page.getByRole("heading", { level: 1, name: "Konto aktywne" }),
  ).toBeVisible();
}

/** A2: sign in through the login form. Lands on the onboarding step (#15). */
export async function logIn(
  page: Page,
  credentials: { email: string; password: string },
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Adres e-mail").fill(credentials.email);
  await page.getByLabel("Hasło").fill(credentials.password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
}

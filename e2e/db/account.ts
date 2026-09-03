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

  await page.goto(verifyUrl);
  await expect(
    page.getByRole("heading", { level: 1, name: "Konto aktywne" }),
  ).toBeVisible();

  // The heading above renders for ANY visit without an ?error parameter —
  // e2e/register.spec.ts reaches it with no token at all — so on its own it
  // says only that the redirect carried no error. Walking the same link a
  // second time is what makes this step load-bearing: a consumed token has to
  // be refused, which also covers A1's reused-token case through the browser.
  await page.goto(verifyUrl);
  await expect(
    page.getByRole("heading", { level: 1, name: "Nieprawidłowy link" }),
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

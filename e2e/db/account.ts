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
  /** The address this invented visitor arrives from — see registerAndVerify. */
  ip: string;
}

export function newIdentity(): Identity {
  const bytes = randomBytes(5);
  const suffix = bytes.toString("hex");
  return {
    // .test is reserved for exactly this (RFC 2606) — it can never resolve to
    // a real mailbox, whatever transport a future environment configures.
    email: `e2e-${suffix}@platform-lite.test`,
    password: `e2e-passphrase-${suffix}`,
    handle: `e2e-${suffix}`,
    displayName: `E2E Studio ${suffix}`,
    // 198.18.0.0/15 is reserved for benchmarking between two devices
    // (RFC 2544) and routes nowhere on the internet, so it can never be a
    // real visitor's address. Two octets of the same randomness the rest of
    // the identity is built from: one invented visitor, one address.
    ip: `198.18.${bytes[3]}.${bytes[4]}`,
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
  // Sign-up is capped at ten an hour per address (src/lib/auth.ts), and the
  // whole run reaches the dev server from one. A full chromium-db run signed
  // up ten times — the cap exactly, since two of the specs are not serial and
  // so register once per worker — which left every retry to push some
  // unrelated spec into a 429 that surfaces as a screen that simply never
  // arrives (#160). The limit is deliberate product behaviour, and what holds
  // it to account is src/lib/auth.test.ts, which spends ten sign-ups and
  // asserts the eleventh is refused; so it stays as it is here, and each
  // invented visitor arrives from its own address instead — the limiter still
  // runs for real, it just stops counting eight strangers as one. Those tests
  // invent an address each for the same reason.
  //
  // This one request, not the page: page.setExtraHTTPHeaders puts the header
  // on every request the page makes, and a header the browser does not know
  // turns the cross-origin PUT that uploads a photo into a preflighted one,
  // which the bucket's CORS rules refuse. Measured here on 12.09.2026 — it
  // cost the whole upload chain, three runs out of three.
  const signUp = "**/api/auth/sign-up/email";
  await page.route(signUp, (route) =>
    route.continue({
      headers: { ...route.request().headers(), "x-forwarded-for": identity.ip },
    }),
  );

  await page.goto("/register");
  await page.getByLabel("Adres e-mail").fill(identity.email);
  await page.getByLabel("Hasło").fill(identity.password);
  await page.getByRole("button", { name: "Zarejestruj się" }).click();

  // The form only swaps to this once the server accepted the sign-up, which
  // is also when the verification message has been delivered.
  await expect(
    page.getByRole("heading", { name: "Sprawdź skrzynkę" }),
  ).toBeVisible();
  // The address was for the sign-up; the rest of the journey is an ordinary
  // visitor again.
  await page.unroute(signUp);

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

// Better Auth caps /sign-in/email at three attempts per ten seconds per IP,
// and the specs in this directory run in parallel from one address — #160 gave
// each identity its own only for the sign-up it is created with. Three logins
// already sat exactly on that cap; the fourth one — added with the avatar spec
// — started pushing a random spec into a 429, which surfaces as a screen that
// simply never arrives.
//
// The limit is deliberate product behaviour (A2), so the answer is to wait it
// out rather than to loosen it. Only a 429 is retried, and only once: any
// other failed login still fails loudly, which is the point of these specs.
const RATE_LIMITED = "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.";
const RATE_LIMIT_WINDOW_MS = 11_000;

/** A2: sign in through the login form. Lands on the onboarding step (#15). */
export async function logIn(
  page: Page,
  credentials: { email: string; password: string },
): Promise<void> {
  await submitLogin(page, credentials);
  const limited = page.getByText(RATE_LIMITED);
  if (await limited.isVisible().catch(() => false)) {
    await page.waitForTimeout(RATE_LIMIT_WINDOW_MS);
    await submitLogin(page, credentials);
    await expect(limited).toBeHidden();
  }
}

async function submitLogin(
  page: Page,
  credentials: { email: string; password: string },
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Adres e-mail").fill(credentials.email);
  await page.getByLabel("Hasło").fill(credentials.password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  // The form answers either way — a navigation, or an inline message — so
  // give it a moment to have answered at all before deciding which happened.
  await page
    .getByText(RATE_LIMITED)
    .waitFor({ state: "visible", timeout: 2_000 })
    .catch(() => {});
}

/**
 * Past the onboarding gate (#15/#36) and onto the live profile page: the name
 * first, then the address derived from it, which is where the claim lands
 * since #58 folded the profile-settings screen away.
 *
 * Deliberately not shared with e2e/db/happy-path.spec.ts, which walks the same
 * two steps by hand. There the steps ARE the subject — that the button is
 * disabled without a name, that the address is proposed and can be replaced,
 * that the availability check answers. Here they are a turnstile on the way to
 * a different screen, and a helper that asserted all of that would make an
 * unrelated test fail for reasons it is not about.
 */
export async function completeOnboarding(
  page: Page,
  identity: Identity,
): Promise<void> {
  // logIn() returns as soon as it has clicked; the onboarding page arrives a
  // navigation later. Waiting for its heading rather than typing into
  // whatever happens to be on screen — without this the fill raced the
  // navigation and failed one run in four.
  await expect(
    page.getByRole("heading", { level: 1, name: "Ustaw nazwę profilu" }),
  ).toBeVisible();
  await page.getByLabel("Twoja nazwa").fill(identity.displayName);
  await page.getByRole("button", { name: "Dalej" }).click();
  await page.getByLabel("Adres profilu").fill(identity.handle);
  // The availability check is debounced and then goes to the server; the
  // submit does nothing useful until it has answered.
  await expect(page.getByText("Ten adres jest wolny.")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Ustaw adres" }).click();
  // The claim lands on the address it just created, carrying the name it was
  // submitted with as the profile's heading.
  await expect(
    page.getByRole("heading", { level: 1, name: identity.displayName }),
  ).toBeVisible();
}

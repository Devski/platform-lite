import { expect, test } from "@playwright/test";
import { logIn, newIdentity, registerAndVerify } from "./account";
import { waitForEmail, waitForEmailLink } from "./email-log";

// A3 end to end, the smoke SPEC.md §6 asks for next to the happy path: the
// request form sends a real single-use link, the link sets a real new
// password, the old one stops working and the account address is notified.
// The DB-less spec (e2e/reset-password.spec.ts) covers the same screens with
// mocked responses; only this one proves the token round-trip.

// In CI the variable is not optional: ci.yml gives this project its own step
// with the database in `env:`, so an unset one means the workflow was edited
// wrongly — moving that block up to the job level is the documented hazard. A
// skip there would report this file as green having run nothing at all, so the
// run fails instead, naming the place to look.
if (process.env.CI && !process.env.DATABASE_URL_TEST?.trim()) {
  throw new Error(
    "DATABASE_URL_TEST is unset, so the chromium-db project would skip itself. In CI that is a broken workflow: check the step env in .github/workflows/ci.yml.",
  );
}
test.skip(
  !process.env.DATABASE_URL_TEST?.trim(),
  "no DATABASE_URL_TEST: the password-reset round trip has nothing to run against",
);

test.use({ locale: "pl-PL" });

test("a forgotten password is reset through the e-mailed link", async ({
  page,
}) => {
  // Registration, verification and two logins on top of the reset itself.
  test.setTimeout(180_000);

  const identity = newIdentity();
  const newPassword = `${identity.password}-reset`;

  await registerAndVerify(page, identity);

  await test.step("request the link from the login page", async () => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Nie pamiętasz hasła?" }).click();
    // Both pages label their address field the same way, so wait for the
    // client-side navigation to land before typing — otherwise the value goes
    // into the login form and is thrown away by the route change.
    await expect(
      page.getByRole("heading", { level: 1, name: "Zresetuj hasło" }),
    ).toBeVisible();
    await page.getByLabel("Adres e-mail").fill(identity.email);
    await page.getByRole("button", { name: "Wyślij link" }).click();
    // Checked before the positive assertion because the two failures look
    // identical from the outside. src/lib/auth.ts caps this endpoint at three
    // requests an hour, the local server keeps its counters between runs
    // (reuseExistingServer), and a rate-limited attempt renders this message
    // instead of swapping the form — which would otherwise fail as "heading
    // not found", the same words an unreachable database produces.
    await expect(
      page.getByText("Limit 3 żądań na godzinę został wykorzystany."),
      "rate-limited: this is the fourth reset request within the hour, not a broken form",
    ).toHaveCount(0);
    // Deliberately the same answer for a known and an unknown address.
    await expect(
      page.getByRole("heading", { name: "Sprawdź skrzynkę" }),
    ).toBeVisible();
  });

  await test.step("the link opens the new-password form", async () => {
    const resetUrl = await waitForEmailLink({
      to: identity.email,
      linkPattern: /\/api\/auth\/reset-password\//,
      what: "password reset",
    });
    await page.goto(resetUrl);
    await expect(
      page.getByRole("heading", { level: 1, name: "Ustaw nowe hasło" }),
    ).toBeVisible();
  });

  await test.step("the new password is stored and confirmed by e-mail", async () => {
    await page.getByLabel("Nowe hasło").fill(newPassword);
    await page.getByRole("button", { name: "Zmień hasło" }).click();
    await expect(
      page.getByRole("heading", { name: "Hasło zmienione" }),
    ).toBeVisible();
    // A3: the account address is told the password changed.
    await waitForEmail({
      to: identity.email,
      pattern: /Twoje hasło zostało zmienione/,
      what: "password-changed notification",
    });
  });

  await test.step("the old password no longer works", async () => {
    await logIn(page, identity);
    await expect(
      page.getByText("Nieprawidłowy e-mail lub hasło."),
    ).toBeVisible();
  });

  await test.step("the new password signs the user in", async () => {
    await logIn(page, { email: identity.email, password: newPassword });
    // No handle yet, so #15's onboarding step is where a login lands.
    await expect(
      page.getByRole("heading", { level: 1, name: "Ustaw swój adres profilu" }),
    ).toBeVisible();
  });
});

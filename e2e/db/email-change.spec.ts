import { expect, test } from "@playwright/test";
import { logIn, newIdentity, registerAndVerify } from "./account";
import { waitForEmailLink } from "./email-log";

// A10 end to end: the settings form, the two links, and the inbox each one
// reaches. src/lib/auth-account.test.ts pins the flow against the database;
// this walks it through the browser, because the note the form leaves behind
// has to send the owner to the inbox the first link really lands in. It used
// to say "check the new inbox" while the approval waited in the current one
// (F-ACCOUNT-11 in docs/ui-specification.md).

// In CI the variable is not optional — see e2e/db/password-reset.spec.ts, which
// carries the same guard for the same reason.
if (process.env.CI && !process.env.DATABASE_URL_TEST?.trim()) {
  throw new Error(
    "DATABASE_URL_TEST is unset, so the chromium-db project would skip itself. In CI that is a broken workflow: check the step env in .github/workflows/ci.yml.",
  );
}
test.skip(
  !process.env.DATABASE_URL_TEST?.trim(),
  "no DATABASE_URL_TEST: the e-mail change round trip has nothing to run against",
);

test.use({ locale: "pl-PL" });

test("an e-mail change is approved from the current inbox and finished from the new one", async ({
  page,
}) => {
  // Registration, verification and a login before the change itself.
  test.setTimeout(180_000);

  const identity = newIdentity();
  const newEmail = newIdentity().email;

  await registerAndVerify(page, identity);
  await logIn(page, identity);
  // No handle yet, so a login lands on onboarding; the settings page is open
  // to such an account all the same.
  await expect(
    page.getByRole("heading", { level: 1, name: "Ustaw nazwę profilu" }),
  ).toBeVisible();

  await test.step("the note sends the owner to the current inbox", async () => {
    // /change-email is capped at three an hour per IP, and a local server keeps
    // its counters between runs; this invented visitor gets its own IP for the
    // one request, as the sign-up does (e2e/db/account.ts).
    await page.route("**/api/auth/change-email", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-forwarded-for": identity.ip,
        },
      }),
    );
    await page.goto("/settings/account");
    await page.getByLabel("Nowy adres e-mail").fill(newEmail);
    await page
      .getByRole("button", { name: "Wyślij link potwierdzający" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Sprawdź obecną skrzynkę" }),
    ).toBeVisible();
    const note = page.getByText(/wysłaliśmy na Twój obecny adres/);
    await expect(note).toContainText(identity.email);
    await expect(note).toContainText(newEmail);
  });

  await test.step("the approval link is in the current inbox", async () => {
    const approveUrl = await waitForEmailLink({
      to: identity.email,
      // Narrowed by its callback. The sign-up link already in this inbox has
      // the same shape, and the approval is sent off the response path
      // (advanced.backgroundTasks in src/lib/auth.ts), so it can be logged
      // after the note appears — a bare verify-email pattern would hand back
      // the sign-up link.
      linkPattern: /\/verify-email\?token=.+email-changed/,
      what: "e-mail change approval",
    });
    await page.goto(approveUrl);
    await expect(
      page.getByRole("heading", { level: 1, name: "Zmiana zatwierdzona" }),
    ).toBeVisible();
  });

  await test.step("the new inbox gets the link that finishes it", async () => {
    const verifyUrl = await waitForEmailLink({
      to: newEmail,
      linkPattern: /\/api\/auth\/verify-email\?token=/,
      what: "new-address verification",
    });
    await page.goto(verifyUrl);
    await expect(
      page.getByRole("heading", { level: 1, name: "Adres zmieniony" }),
    ).toBeVisible();
  });
});

import { expect, test, type Route } from "@playwright/test";

// Render + hydration smoke for the #29 two-factor login challenge. DB-less
// with mocked auth responses, like the other auth specs; the real token
// round-trips live in src/lib/auth-2fa.test.ts.

const jsonResponse = (status: number, body: unknown) => (route: Route) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

test.describe("Polish browser", () => {
  test.use({ locale: "pl-PL" });

  test("a 2FA account is sent from login to the challenge page", async ({
    page,
  }) => {
    await page.route(
      "**/api/auth/sign-in/email",
      jsonResponse(200, {
        twoFactorRedirect: true,
        twoFactorMethods: ["otp", "totp"],
      }),
    );
    await page.goto("/login");
    await page.getByLabel("Adres e-mail").fill("user@example.com");
    await page.getByLabel("Hasło").fill("correct-password");
    await page.getByRole("button", { name: "Zaloguj się" }).click();

    await expect(page).toHaveURL(/\/two-factor(\?|$)/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Potwierdź logowanie" }),
    ).toBeVisible();
    // Both offered methods plus the backup option are shown as tabs.
    await expect(page.getByRole("button", { name: "Aplikacja" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kod e-mail" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Kod zapasowy" }),
    ).toBeVisible();
  });

  test("the e-mail path sends a code then verifies it to a session", async ({
    page,
  }) => {
    await page.route(
      "**/api/auth/two-factor/send-otp",
      jsonResponse(200, { status: true }),
    );
    await page.route(
      "**/api/auth/two-factor/verify-otp",
      jsonResponse(200, { token: "session-token", user: { id: "u1" } }),
    );
    await page.goto("/two-factor");

    await page.getByRole("button", { name: "Kod e-mail" }).click();
    // The code field is locked until a code has been sent.
    await expect(page.getByLabel("Kod")).toBeDisabled();
    await page.getByRole("button", { name: "Wyślij kod na e-mail" }).click();
    await expect(page.getByText("Kod wysłany — sprawdź skrzynkę.")).toBeVisible();

    await page.getByLabel("Kod").fill("123456");
    await page.getByRole("button", { name: "Potwierdź" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("a wrong authenticator code shows an inline error", async ({ page }) => {
    await page.route(
      "**/api/auth/two-factor/verify-totp",
      jsonResponse(401, { code: "INVALID_CODE", message: "Invalid code" }),
    );
    await page.goto("/two-factor");

    await page.getByRole("button", { name: "Aplikacja" }).click();
    await page.getByLabel("Kod").fill("000000");
    await page.getByRole("button", { name: "Potwierdź" }).click();
    await expect(
      page.getByText("Nieprawidłowy kod. Spróbuj ponownie."),
    ).toBeVisible();
  });
});

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("/en/two-factor renders the English challenge", async ({ page }) => {
    await page.goto("/en/two-factor");
    await expect(page).toHaveTitle("Two-factor verification");
    await expect(
      page.getByRole("heading", { level: 1, name: "Confirm your login" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to login" }),
    ).toBeVisible();
  });
});

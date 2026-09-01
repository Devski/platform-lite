import { expect, test } from "@playwright/test";

// Render smoke for the #10 account-settings surfaces. This job runs with no
// database, which is exactly what proves the (app) gate fails closed; the
// signed-in forms cannot render here (the session check is server-side), so
// their behavior lives in src/lib/auth-account.test.ts.

test.describe("Polish browser", () => {
  test.use({ locale: "pl-PL" });

  test("/settings/account without a session lands on the login page", async ({
    page,
  }) => {
    await page.goto("/settings/account");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Zaloguj się" }),
    ).toBeVisible();
  });

  test("/email-changed separates the approval landing from the completed change", async ({
    page,
  }) => {
    // The old-address approval click lands here plain: "check your new inbox".
    await page.goto("/email-changed");
    await expect(page).toHaveTitle("Zmiana adresu");
    await expect(
      page.getByRole("heading", { level: 1, name: "Zmiana zatwierdzona" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Przejdź do ustawień konta" }),
    ).toBeVisible();

    // The new-address verification click lands with ?status=done: "changed".
    await page.goto("/email-changed?status=done");
    await expect(
      page.getByRole("heading", { level: 1, name: "Adres zmieniony" }),
    ).toBeVisible();
  });

  test("an expired link and a revoked link get their own copy", async ({
    page,
  }) => {
    await page.goto("/email-changed?error=TOKEN_EXPIRED");
    await expect(
      page.getByRole("heading", { level: 1, name: "Link wygasł" }),
    ).toBeVisible();

    await page.goto("/email-changed?error=INVALID_TOKEN");
    await expect(
      page.getByRole("heading", { level: 1, name: "Nieprawidłowy link" }),
    ).toBeVisible();
    await expect(
      page.getByText("został unieważniony", { exact: false }),
    ).toBeVisible();
  });
});

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("/en/settings/account redirects to the English login page", async ({
    page,
  }) => {
    await page.goto("/en/settings/account");
    await expect(page).toHaveURL(/\/en\/login$/);
  });

  test("/en/email-changed renders the English states", async ({ page }) => {
    await page.goto("/en/email-changed?error=USER_NOT_FOUND");
    await expect(
      page.getByRole("heading", { level: 1, name: "Invalid link" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go to the account settings" }),
    ).toBeVisible();
  });
});

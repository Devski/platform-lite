import { expect, test, type Route } from "@playwright/test";

// Render + hydration smoke for the password-reset flow (A3). Nothing here
// talks to a database, so the suite stays runnable on the DB-less CI job;
// the real token round-trip is proven by src/lib/auth-reset.test.ts.

const jsonResponse = (status: number, body: unknown) => (route: Route) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

test.describe("Polish browser", () => {
  test.use({ locale: "pl-PL" });

  test("/login links to the reset flow", async ({ page }) => {
    await page.goto("/login");
    const link = page.getByRole("link", { name: "Nie pamiętasz hasła?" });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/reset-password$/);
  });

  test("/reset-password renders the Polish request form", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page).toHaveTitle("Reset hasła");
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(
      page.getByRole("heading", { level: 1, name: "Zresetuj hasło" }),
    ).toBeVisible();
    await expect(page.getByLabel("Adres e-mail")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Wyślij link" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
  });

  test("client-side validation blocks an invalid address without calling the API", async ({
    page,
  }) => {
    let requests = 0;
    await page.route("**/api/auth/request-password-reset", (route) => {
      requests++;
      return route.abort();
    });
    await page.goto("/reset-password");
    await page.getByRole("button", { name: "Wyślij link" }).click();
    await expect(page.getByText("Podaj poprawny adres e-mail.")).toBeVisible();
    expect(requests).toBe(0);
  });

  test("an accepted request swaps to the check-your-inbox state", async ({
    page,
  }) => {
    await page.route(
      "**/api/auth/request-password-reset",
      jsonResponse(200, { status: true }),
    );
    await page.goto("/reset-password");
    await page.getByLabel("Adres e-mail").fill("user@example.com");
    await page.getByRole("button", { name: "Wyślij link" }).click();
    await expect(
      page.getByRole("heading", { name: "Sprawdź skrzynkę" }),
    ).toBeVisible();
    await expect(
      page.getByText("Jeśli konto o adresie user@example.com istnieje", {
        exact: false,
      }),
    ).toBeVisible();
  });

  test("a 429 maps to the hourly-limit message", async ({ page }) => {
    await page.route(
      "**/api/auth/request-password-reset",
      jsonResponse(429, { message: "Too many requests" }),
    );
    await page.goto("/reset-password");
    await page.getByLabel("Adres e-mail").fill("user@example.com");
    await page.getByRole("button", { name: "Wyślij link" }).click();
    await expect(
      page.getByText("Limit 3 żądań na godzinę został wykorzystany", {
        exact: false,
      }),
    ).toBeVisible();
  });

  test("/reset-password/new without a token offers requesting a fresh link", async ({
    page,
  }) => {
    await page.goto("/reset-password/new?error=INVALID_TOKEN");
    await expect(
      page.getByRole("heading", { level: 1, name: "Nieprawidłowy link" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Wyślij nowy link" }).click();
    await expect(page).toHaveURL(/\/reset-password$/);
  });

  test("a valid token renders the new-password form and validates the bounds client-side", async ({
    page,
  }) => {
    let requests = 0;
    await page.route("**/api/auth/reset-password", (route) => {
      requests++;
      return route.abort();
    });
    await page.goto("/reset-password/new?token=test-token");
    await expect(
      page.getByRole("heading", { level: 1, name: "Ustaw nowe hasło" }),
    ).toBeVisible();
    await page.getByLabel("Nowe hasło").fill("1234567");
    await page.getByRole("button", { name: "Zmień hasło" }).click();
    await expect(
      page.getByText("Hasło musi mieć co najmniej 8 znaków."),
    ).toBeVisible();
    expect(requests).toBe(0);
  });

  test("a successful change confirms and links to login", async ({ page }) => {
    await page.route(
      "**/api/auth/reset-password",
      jsonResponse(200, { status: true }),
    );
    await page.goto("/reset-password/new?token=test-token");
    await page.getByLabel("Nowe hasło").fill("brand new passphrase");
    await page.getByRole("button", { name: "Zmień hasło" }).click();
    await expect(
      page.getByRole("heading", { name: "Hasło zmienione" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
  });

  test("a dead token on submit offers requesting a fresh link", async ({
    page,
  }) => {
    await page.route(
      "**/api/auth/reset-password",
      jsonResponse(400, { code: "INVALID_TOKEN", message: "Invalid token" }),
    );
    await page.goto("/reset-password/new?token=used-token");
    await page.getByLabel("Nowe hasło").fill("brand new passphrase");
    await page.getByRole("button", { name: "Zmień hasło" }).click();
    await expect(
      page.getByText("Ten link jest niepoprawny", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Wyślij nowy link" }),
    ).toBeVisible();
  });
});

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("/en/reset-password renders the English request form", async ({
    page,
  }) => {
    await page.goto("/en/reset-password");
    await expect(page).toHaveTitle("Password reset");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { level: 1, name: "Reset your password" }),
    ).toBeVisible();
    await expect(page.getByLabel("E-mail address")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send the link" }),
    ).toBeVisible();
  });

  test("/en/reset-password/new renders the English new-password form", async ({
    page,
  }) => {
    await page.goto("/en/reset-password/new?token=test-token");
    await expect(
      page.getByRole("heading", { level: 1, name: "Set a new password" }),
    ).toBeVisible();
    await expect(page.getByLabel("New password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Change the password" }),
    ).toBeVisible();
  });
});

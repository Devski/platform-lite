import { expect, test } from "@playwright/test";

// Render + hydration smoke for the login flow (A2). Nothing here talks to a
// database, so the suite stays runnable on the DB-less CI job; the full
// logged-in journey belongs to #20.

test.describe("Polish browser", () => {
  test.use({ locale: "pl-PL" });

  test("/login renders the Polish form with a register link", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle("Logowanie");
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(
      page.getByRole("heading", { level: 1, name: "Zaloguj się" }),
    ).toBeVisible();
    await expect(page.getByLabel("Adres e-mail")).toBeVisible();
    await expect(page.getByLabel("Hasło")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Zaloguj się" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Zarejestruj się" }),
    ).toBeVisible();
  });

  test("client-side validation blocks an empty submit", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await expect(page.getByText("Podaj poprawny adres e-mail.")).toBeVisible();
    await expect(page.getByText("Podaj hasło.")).toBeVisible();
  });

  test("a network failure shows a generic error and re-enables the form", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.route("**/api/auth/sign-in/email", (route) => route.abort());
    await page.getByLabel("Adres e-mail").fill("net@example.com");
    await page.getByLabel("Hasło").fill("whatever-password");
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await expect(
      page.getByText("Logowanie nie powiodło się. Spróbuj ponownie."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Zaloguj się" }),
    ).toBeEnabled();
  });

  test("the homepage degrades to signed-out entry links without a backend", async ({
    page,
  }) => {
    await page.goto("/");
    // No DATABASE_URL in this environment: /get-session fails server-side and
    // the session panel must still settle on the signed-out links (A11 entry).
    await expect(page.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Załóż konto" })).toBeVisible();
  });

  test("the register page links back to login", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
  });
});

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("/en/login renders the English form", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page).toHaveTitle("Log in");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { level: 1, name: "Log in" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });
});

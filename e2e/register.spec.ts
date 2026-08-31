import { expect, test } from "@playwright/test";

// Render + hydration smoke for the registration flow (A1). The full happy
// path with a live database belongs to #20; here nothing calls the API, so
// the suite stays runnable on the DB-less CI job.

test.describe("Polish browser", () => {
  test.use({ locale: "pl-PL" });

  test("/register renders the Polish form", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveURL("/register");
    await expect(page).toHaveTitle("Rejestracja");
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(
      page.getByRole("heading", { level: 1, name: "Załóż konto" }),
    ).toBeVisible();
    await expect(page.getByLabel("Adres e-mail")).toBeVisible();
    await expect(page.getByLabel("Hasło")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Zarejestruj się" }),
    ).toBeVisible();
  });

  test("client-side validation speaks Polish and blocks the submit", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByLabel("Adres e-mail").fill("nie-adres");
    await page.getByLabel("Hasło").fill("1234567");
    await page.getByRole("button", { name: "Zarejestruj się" }).click();
    await expect(page.getByText("Podaj poprawny adres e-mail.")).toBeVisible();
    await expect(
      page.getByText("Hasło musi mieć co najmniej 8 znaków."),
    ).toBeVisible();
  });

  test("a network failure shows a generic error and re-enables the form", async ({
    page,
  }) => {
    await page.goto("/register");
    // Abort at the network layer: better-fetch rethrows when no HTTP
    // response arrived, and the form must not stay stuck on "submitting".
    await page.route("**/api/auth/sign-up/email", (route) => route.abort());
    await page.getByLabel("Adres e-mail").fill("net@example.com");
    await page.getByLabel("Hasło").fill("dlugie-haslo-123");
    await page.getByRole("button", { name: "Zarejestruj się" }).click();
    await expect(
      page.getByText("Rejestracja nie powiodła się. Spróbuj ponownie."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Zarejestruj się" }),
    ).toBeEnabled();
  });

  test("the verification landing page renders the expired state with a resend form", async ({
    page,
  }) => {
    await page.goto("/register/verified?error=TOKEN_EXPIRED");
    await expect(
      page.getByRole("heading", { level: 1, name: "Link wygasł" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Wyślij nowy link" }),
    ).toBeVisible();
  });

  test("the verification landing page renders the success state", async ({
    page,
  }) => {
    await page.goto("/register/verified");
    await expect(
      page.getByRole("heading", { level: 1, name: "Konto aktywne" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Przejdź na stronę główną" }),
    ).toBeVisible();
  });
});

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("/en/register renders the English form", async ({ page }) => {
    await page.goto("/en/register");
    await expect(page).toHaveTitle("Sign up");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { level: 1, name: "Create your account" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
  });
});

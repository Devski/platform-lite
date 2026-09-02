import { expect, test, type Route } from "@playwright/test";

// Render + hydration smoke for the login flow (A2). Nothing here talks to a
// database, so the suite stays runnable on the DB-less CI job; the full
// logged-in journey belongs to #20.

const jsonResponse = (status: number, body: unknown) => (route: Route) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

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

  test("client-side validation blocks an empty submit without calling the API", async ({
    page,
  }) => {
    let signInRequests = 0;
    await page.route("**/api/auth/sign-in/email", (route) => {
      signInRequests++;
      return route.abort();
    });
    await page.goto("/login");
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await expect(page.getByText("Podaj poprawny adres e-mail.")).toBeVisible();
    await expect(page.getByText("Podaj hasło.")).toBeVisible();
    expect(signInRequests).toBe(0);
  });

  test("maps 401 and 429 responses to their dictionary messages", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.route(
      "**/api/auth/sign-in/email",
      jsonResponse(401, {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      }),
    );
    await page.getByLabel("Adres e-mail").fill("user@example.com");
    await page.getByLabel("Hasło").fill("wrong-password");
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await expect(
      page.getByText("Nieprawidłowy e-mail lub hasło."),
    ).toBeVisible();

    await page.route(
      "**/api/auth/sign-in/email",
      jsonResponse(429, { message: "Too many requests" }),
    );
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await expect(
      page.getByText("Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie."),
    ).toBeVisible();
  });

  test("an unverified account offers the resend flow, and its state resets on resubmit", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.route(
      "**/api/auth/sign-in/email",
      jsonResponse(403, {
        code: "EMAIL_NOT_VERIFIED",
        message: "Email not verified",
      }),
    );
    await page.route(
      "**/api/auth/send-verification-email",
      jsonResponse(200, { status: true }),
    );
    await page.getByLabel("Adres e-mail").fill("unverified@example.com");
    await page.getByLabel("Hasło").fill("correct-password");
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await expect(
      page.getByText("Konto nie zostało jeszcze aktywowane", { exact: false }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Wyślij link aktywacyjny ponownie" })
      .click();
    await expect(page.getByText("Wysłane — sprawdź skrzynkę.")).toBeVisible();

    // A new submit is a new context: the stale "sent" confirmation must not
    // survive into the next not-verified block.
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await expect(
      page.getByText("Konto nie zostało jeszcze aktywowane", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("Wysłane — sprawdź skrzynkę."),
    ).not.toBeVisible();
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
    // A11's full-screen photo. The box is CSS-forced (absolute inset-0), so
    // toBeVisible() would pass with a 404 behind it — assert the bitmap
    // decoded instead. And decorative means out of the accessibility tree,
    // whichever way that is spelled in the markup.
    const photo = page.locator('img[src="/landing-placeholder.webp"]');
    await expect
      .poll(() => photo.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(page.getByRole("img")).toHaveCount(0);
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
    await expect(page.getByLabel("E-mail address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("validation and error messages come from the English dictionary", async ({
    page,
  }) => {
    await page.goto("/en/login");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Enter a valid e-mail address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();

    await page.route(
      "**/api/auth/sign-in/email",
      jsonResponse(401, {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      }),
    );
    await page.getByLabel("E-mail address").fill("user@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Invalid e-mail or password.")).toBeVisible();
  });
});

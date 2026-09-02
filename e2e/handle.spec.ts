import { expect, test } from "@playwright/test";

// DB-less smoke for the #15 handle surfaces: the onboarding step sits behind
// the (app) session gate (fail closed → /login) and both handle routes
// answer 401, never 500, with no database at all. The picker itself needs a
// session and a database, so its rules live in src/lib/profile-handle.test.ts
// and the signed-in journey belongs to #20.

test.describe("Polish browser", () => {
  test.use({ locale: "pl-PL" });

  test("/onboarding without a session lands on the login page", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Zaloguj się" }),
    ).toBeVisible();
  });

  test("the handle API routes refuse an unauthenticated caller with 401", async ({
    request,
  }) => {
    const availability = await request.get(
      "/api/handle/availability?handle=abc",
    );
    expect(availability.status()).toBe(401);
    const set = await request.post("/api/profile/handle", {
      data: { handle: "abc" },
    });
    expect(set.status()).toBe(401);
  });

  test("the verification landing page offers the onboarding step", async ({
    page,
  }) => {
    await page.goto("/register/verified");
    await expect(
      page.getByRole("link", { name: "Ustaw adres profilu" }),
    ).toHaveAttribute("href", "/onboarding");
    await expect(
      page.getByRole("link", { name: "Przejdź na stronę główną" }),
    ).toBeVisible();
  });
});

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("/en/onboarding redirects to the English login page", async ({
    page,
  }) => {
    await page.goto("/en/onboarding");
    await expect(page).toHaveURL(/\/en\/login$/);
  });

  test("/en/register/verified links to the English onboarding step", async ({
    page,
  }) => {
    await page.goto("/en/register/verified");
    await expect(
      page.getByRole("link", { name: "Set up your profile address" }),
    ).toHaveAttribute("href", "/en/onboarding");
  });
});

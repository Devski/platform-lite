import { expect, test } from "@playwright/test";

// DB-less smoke for the #15 handle surfaces: the onboarding step sits behind
// the (app) session gate (fail closed → /login) and both handle routes
// answer 401, never 500, with no database at all. The picker itself needs a
// session and a database, so its rules live in src/lib/profile-handle.test.ts
// and the signed-in journey belongs to #20. The #16 old-address redirect
// (src/proxy.ts) is covered the same way: without a database its lookup
// fails open and the request reaches the pages, where no /[handle] route
// exists until #18 — so a handle-shaped path is a 404, never a 500.

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

  test("a handle-shaped path and a reserved word are 404 without a database", async ({
    request,
  }) => {
    // The proxy's redirect lookup has no DATABASE_URL and falls through
    // (src/proxy.test.ts proves the branch; this proves the wiring).
    const oldAddress = await request.get("/some-old-address");
    expect(oldAddress.status()).toBe(404);
    // A reserved word never reaches the lookup at all.
    const reserved = await request.get("/admin");
    expect(reserved.status()).toBe(404);
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

  test("/en/some-old-address is 404 without a database", async ({
    request,
  }) => {
    const response = await request.get("/en/some-old-address");
    expect(response.status()).toBe(404);
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

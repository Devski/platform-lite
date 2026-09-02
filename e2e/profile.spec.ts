import { expect, test } from "@playwright/test";

// DB-less smoke for the #18 public profile page. Without a database every
// address resolves to "no such profile" (the page maps a missing
// DATABASE_URL to notFound, so an outage cannot masquerade as a free
// handle), which is exactly what proves the two things this job can prove:
// the localized 404 body (A8) and the A7 noindex header on every response.
// A live profile needs a database and belongs to the #20 journey.

const UNKNOWN_HANDLE = "some-profile";

test.describe("Polish browser", () => {
  test.use({ locale: "pl-PL" });

  test("an unknown address answers 404 with the Polish not-found page", async ({
    page,
  }) => {
    const response = await page.goto(`/${UNKNOWN_HANDLE}`);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Nie znaleziono strony" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Przejdź na stronę główną" }),
    ).toHaveAttribute("href", "/");
  });

  test("every page carries X-Robots-Tag: noindex outside production (A7)", async ({
    request,
  }) => {
    for (const path of ["/", "/login", `/${UNKNOWN_HANDLE}`]) {
      const response = await request.get(path);
      expect(response.headers()["x-robots-tag"]).toBe("noindex");
    }
  });

  test("a reserved word stays a 404, it is never a profile address", async ({
    request,
  }) => {
    const response = await request.get("/admin");
    expect(response.status()).toBe(404);
  });
});

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("/en/<unknown> answers 404 with the English not-found page", async ({
    page,
  }) => {
    const response = await page.goto(`/en/${UNKNOWN_HANDLE}`);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go to the home page" }),
    ).toHaveAttribute("href", "/en");
  });
});

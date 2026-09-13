import { expect, test } from "@playwright/test";

// DB-less smoke for addresses no route claims (F-SHELL-3 in
// docs/ui-specification.md). A single unknown segment is a would-be profile
// and e2e/profile.spec.ts covers it; these have two or more segments, which
// src/app/[locale]/[...rest]/page.tsx claims.

test.describe("Polish browser", () => {
  test.use({ locale: "pl-PL" });

  test("an address no page claims answers 404 with the Polish not-found page", async ({
    page,
  }) => {
    const response = await page.goto("/some-profile/works");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Zgubiliśmy się?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Wróć do domu" }),
    ).toHaveAttribute("href", "/");
  });
});

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("/en/<no such page> answers 404 with the English not-found page", async ({
    page,
  }) => {
    // /settings/account sits behind the (app) session gate; a sibling that
    // does not exist is not the gate's business — a redirect to the login
    // page would put a different heading here.
    const response = await page.goto("/en/settings/unknown");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Lost?" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Back home" })).toHaveAttribute(
      "href",
      "/en",
    );
  });
});

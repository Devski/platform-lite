import { expect, test } from "@playwright/test";

test.describe("Polish browser", () => {
  test.use({ locale: "pl-PL" });

  test("/ renders Polish without a locale prefix", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(
      page.getByRole("heading", { level: 1, name: "platform-lite" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Publiczne profile dla studiów architektury i artystów 3D",
      ),
    ).toBeVisible();
  });

  test("superfluous /pl prefix redirects to the unprefixed path", async ({
    page,
  }) => {
    await page.goto("/pl");
    await expect(page).toHaveURL("/");
  });

  test("switcher moves to /en, persists the choice in a cookie and wins on return", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "NEXT_LOCALE")?.value).toBe("en");

    // The persisted choice overrides Accept-Language on the next visit.
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
  });
});

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("Accept-Language routes / to /en", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByText("Public profiles for architecture studios and 3D artists"),
    ).toBeVisible();
  });
});

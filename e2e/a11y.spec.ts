import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

// #20: axe on the public pages (SPEC.md §6). The two that need no database
// live here — the landing page in both locales (A11) and the localized
// not-found body (A8); a LIVE public profile needs one and is checked in
// e2e/db/happy-path.spec.ts, at the moment the page goes live.

test.describe("Polish browser", () => {
  test.use({ locale: "pl-PL" });

  test("the landing page has no accessibility violations", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "platform-lite" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, testInfo, "landing-pl");
  });

  test("the not-found page has no accessibility violations", async ({
    page,
  }, testInfo) => {
    await page.goto("/some-profile");
    await expect(
      page.getByRole("heading", { level: 1, name: "Nie znaleziono strony" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, testInfo, "not-found-pl");
  });
});

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("the English landing page has no accessibility violations", async ({
    page,
  }, testInfo) => {
    await page.goto("/en");
    await expect(
      page.getByText("Public profiles for architecture studios and 3D artists"),
    ).toBeVisible();
    await expectNoAxeViolations(page, testInfo, "landing-en");
  });

  test("the English not-found page has no accessibility violations", async ({
    page,
  }, testInfo) => {
    await page.goto("/en/some-profile");
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, testInfo, "not-found-en");
  });
});

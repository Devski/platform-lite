import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

// #20: axe on the public pages (SPEC.md §6). The two that need no database
// live here — the landing page in both locales (A11) and the localized
// not-found body (A8); a LIVE public profile needs one and is checked in
// e2e/db/happy-path.spec.ts, at the moment the page goes live.

// The h1 is the slogan now, not the brand (#26): the page leads with what the
// product is for, and the name sits in the top bar. Spelled out here rather
// than shared with e2e/i18n.spec.ts — a spec that reads its expected copy from
// the same place the page does proves nothing.

test.describe("Polish browser", () => {
  test.use({ locale: "pl-PL" });

  // The top bar carries the name and the language choice (Dawid, 06.09.2026),
  // and it is a banner landmark rather than a row of divs: that is what lets a
  // screen-reader user skip it, and what keeps the language links out of the
  // page's main content.
  test("the brand and the language switcher live in the page banner", async ({
    page,
  }) => {
    await page.goto("/");
    const banner = page.getByRole("banner");
    await expect(banner.getByText("Architektów 3d")).toBeVisible();
    await expect(
      banner.getByRole("navigation", { name: "Wybór języka" }),
    ).toBeVisible();
    await expect(banner.getByRole("link", { name: "English" })).toBeVisible();
    // The banner is a sibling of main, not part of it: a landmark nested in
    // main is not a banner at all.
    await expect(page.locator("main").getByRole("banner")).toHaveCount(0);
  });

  test("the landing page has no accessibility violations", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Tu mieszka Twoje portfolio",
      }),
    ).toBeVisible();
    await expectNoAxeViolations(page, testInfo, "landing-pl");
  });

  // WCAG 2.4.7, and a rule axe cannot check: a focus ring that is present in
  // the class attribute but spelled as nonsense is still a valid class token,
  // so only the rendered outline proves it. This caught the language switcher
  // borrowing its ring constant from a "use client" module — across the RSC
  // boundary a server component gets a function stub, and the class attribute
  // shipped the stub's source text instead of the utility.
  test("keyboard focus is visible on the language switcher", async ({
    page,
  }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: "English" });
    // Tab rather than focus(): :focus-visible only matches a programmatic
    // focus when the last interaction was already a keyboard one.
    for (
      let i = 0;
      i < 20 && !(await link.evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(link).toBeFocused();
    const outline = await link.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        width: parseFloat(style.outlineWidth),
        style: style.outlineStyle,
        offset: style.outlineOffset,
      };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
    // The offset is what separates OUR ring from the browser's default one,
    // which is drawn flush against the text and would let this test pass over
    // a broken class attribute.
    expect(outline.offset).toBe("2px");
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
      page.getByRole("heading", {
        level: 1,
        name: "Your portfolio lives here",
      }),
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

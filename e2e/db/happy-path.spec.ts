import { expect, test } from "@playwright/test";
import { isStorageConfigured } from "@/lib/storage";
import { expectNoAxeViolations } from "../axe";
import { logIn, newIdentity, registerAndVerify } from "./account";

// THE happy path — SPEC.md §1's success criterion, driven through the real
// browser UI end to end: registration → e-mail verification → login →
// profile address → display name → (photo) → a live public profile page,
// then the signed-in homepage and signing out again.
//
// Every DB-backed spec is gated the way the S3 suite in
// src/lib/storage-s3.test.ts is: with no test database configured the file
// reports as SKIPPED, it does not fail — a fresh clone has none (SPEC.md §6).
// CI's e2e-full job provides one; e2e-smoke deliberately does not.

// In CI the variable is not optional: ci.yml gives this project its own step
// with the database in `env:`, so an unset one means the workflow was edited
// wrongly — moving that block up to the job level is the documented hazard. A
// skip there would report this file as green having run nothing at all, so the
// run fails instead, naming the place to look.
if (process.env.CI && !process.env.DATABASE_URL_TEST?.trim()) {
  throw new Error(
    "DATABASE_URL_TEST is unset, so the chromium-db project would skip itself. In CI that is a broken workflow: check the step env in .github/workflows/ci.yml.",
  );
}
test.skip(
  !process.env.DATABASE_URL_TEST?.trim(),
  "no DATABASE_URL_TEST: the database-backed journey has nothing to run against",
);

// The photo leg is the #2 tail: presign → browser PUT → confirm needs a real
// S3-compatible bucket, and #2 (OVH onboarding) has not provisioned one. The
// name, the address and the live page are asserted unconditionally; the photo
// runs the day the five S3_* variables are set, and until then the page is
// asserted in its avatar-less state instead.
const photoConfigured = isStorageConfigured();

test.use({ locale: "pl-PL" });

test("a new user goes from the landing page to a live public profile", async ({
  page,
}, testInfo) => {
  // Registration, verification, login, three saves and a page load — well
  // past the 30 s default, especially on a cold CI runner.
  test.setTimeout(180_000);

  const identity = newIdentity();
  // The name typed in onboarding rides with the address claim (#36), so it is
  // already on the profile when the page opens. Starting from a draft is what
  // lets the A4 step below prove it can still be corrected afterwards — and
  // the two names share no substring, because getByRole's name option matches
  // by substring and would otherwise accept the draft as the final name.
  const draftName = `Draft ${identity.handle}`;
  const baseURL = testInfo.project.use.baseURL;
  expect(baseURL, "the project must declare a baseURL").toBeTruthy();

  await test.step("A11: the landing page offers the way in", async () => {
    await page.goto("/");
    await page.getByRole("link", { name: "Załóż konto" }).click();
    await expect(page).toHaveURL(/\/register$/);
  });

  await test.step("A1: register and click the verification link", async () => {
    await registerAndVerify(page, identity);
  });

  await test.step("the onboarding step is gated until login", async () => {
    await page.getByRole("link", { name: "Ustaw adres profilu" }).click();
    // Fail closed: no session yet, so the (app) gate lands on the login page.
    await expect(page).toHaveURL(/\/login$/);
  });

  await test.step("A2: log in", async () => {
    await logIn(page, identity);
    await expect(
      page.getByRole("heading", { level: 1, name: "Ustaw nazwę profilu" }),
    ).toBeVisible();
  });

  await test.step("#36 step one: the name, before the address", async () => {
    // Onboarding asks for the name FIRST and derives the address from it
    // (#36). Nothing can be submitted without one — which is the point:
    // registration no longer invents a name from the e-mail address.
    const next = page.getByRole("button", { name: "Dalej" });
    await expect(next).toBeDisabled();
    await page.getByLabel("Twoja nazwa").fill(draftName);
    await expect(next).toBeEnabled();
    await next.click();
  });

  await test.step("A5: claim the profile address", async () => {
    const field = page.getByLabel("Adres profilu");
    // Opens on the address derived from the name just typed; replace it.
    await expect(field).not.toHaveValue("");
    await field.fill(identity.handle);
    // A5's live check: debounced, then a round trip to the server. Given more
    // room than the default — the form shows no message at all when the check
    // fails, so a slow first answer would read as a broken picker.
    await expect(page.getByText("Ten adres jest wolny.")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Ustaw adres" }).click();
    // #58: the claim lands on the live page it just created, not on a
    // settings screen — the name and the photo are edited right there.
    await expect(page).toHaveURL(new RegExp(`/${identity.handle}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: draftName }),
    ).toBeVisible();
  });

  const pencil = page.getByRole("button", { name: "Edytuj profil" });

  await test.step("A4: correct the display name on the profile itself", async () => {
    // The pencil in the top bar turns the profile's own heading into an
    // input, saved on blur (#58).
    await pencil.click();
    const field = page.getByLabel("Nazwa (studia albo Twoja)");
    await expect(field).toHaveValue(draftName);
    await field.fill(identity.displayName);
    await field.blur();
    // Leaving edit mode puts the SERVER's copy back on screen, so the heading
    // is the saved name and not whatever is still sitting in the input.
    await pencil.click();
    await expect(
      page.getByRole("heading", { level: 1, name: identity.displayName }),
    ).toBeVisible({ timeout: 15_000 });
  });

  // A skipped STEP, not a skipped test: test.skip() inside a test body aborts
  // the whole journey, which would throw away every assertion after it.
  if (photoConfigured) {
    await test.step("A4: upload the profile photo", async () => {
      // A real decodable image, generated here rather than committed: the
      // server verifies the uploaded bytes by decoding them (#12).
      const sharp = (await import("sharp")).default;
      const photo = await sharp({
        create: {
          width: 640,
          height: 480,
          channels: 3,
          background: { r: 29, g: 78, b: 216 },
        },
      })
        .png()
        .toBuffer();
      // The camera badge is a <label> over a visually hidden file input, and
      // both exist only while the pencil is on.
      await pencil.click();
      await page.locator("#owner-avatar-file").setInputFiles({
        name: "studio.png",
        mimeType: "image/png",
        buffer: photo,
      });
      // Upload, fetch back, decode, two variants, publish: slower than a form.
      // The photo landing on the card IS the confirmation now — the screen
      // has no separate success line to show.
      await expect(page.locator("article img")).toHaveAttribute(
        "alt",
        `Zdjęcie profilowe ${identity.displayName}`,
        { timeout: 60_000 },
      );
    });
  }

  await test.step("A7: the public profile page is live", async () => {
    const response = await page.goto(`/${identity.handle}`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: identity.displayName }),
    ).toBeVisible();
    // The design (#58) dropped the visible address from the card — it's
    // still the page's own URL (A5), just not printed on it a second time.
    // A7's <head>: the profile's own title, not the not-found one.
    await expect(page).toHaveTitle(`${identity.displayName} · Architektów 3d`);

    const photoOnPage = page.locator("article img");
    if (photoConfigured) {
      await expect(photoOnPage).toHaveAttribute(
        "alt",
        `Zdjęcie profilowe ${identity.displayName}`,
      );
      // The box is sized by CSS, so toBeVisible() would pass on a broken
      // source — assert the bitmap actually decoded.
      await expect
        .poll(() =>
          photoOnPage.evaluate((el) => (el as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
    } else {
      // The avatar-less state: no image at all, and a decorative circle in
      // its place that says nothing to a screen reader.
      await expect(photoOnPage).toHaveCount(0);
      await expect(page.locator('article div[aria-hidden="true"]')).toHaveCount(
        1,
      );
    }
  });

  await test.step("#20: axe on the live public profile", async () => {
    await expectNoAxeViolations(page, testInfo, "public-profile");
  });

  await test.step("A11: '/' sends a signed-in visitor to their own profile, and signing out", async () => {
    // #58 replaced the old signed-in homepage banner with a redirect
    // straight to the live profile (signed-in-destination.ts) — the account
    // menu in that page's top bar is where "Konto" and "Wyloguj" live now.
    await page.goto("/");
    await expect(page).toHaveURL(new RegExp(`/${identity.handle}$`));
    await page.getByRole("button", { name: "Menu konta" }).click();
    // The menu's items carry an explicit role="menuitem" (ARIA menu pattern),
    // overriding the <a>'s implicit "link" role.
    await expect(page.getByRole("menuitem", { name: "Konto" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Wyloguj" }).click();
    // Back to the two entry buttons the signed-out visitor sees.
    await expect(page.getByRole("link", { name: "Załóż konto" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
  });
});

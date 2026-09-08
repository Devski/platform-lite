import { expect, test, type Page } from "@playwright/test";
import {
  completeOnboarding,
  logIn,
  newIdentity,
  registerAndVerify,
  type Identity,
} from "./account";

// #83: leaving the owner's page while editing asks first. Back and forward
// and a link in the app get our dialog; a reload or a closed tab gets the
// browser's (proven here by the cancelled beforeunload event, which is what
// the browser keys its dialog on). Ending editing with "Zapisz" leaves no
// guard behind: the next back goes where it always went.

if (process.env.CI && !process.env.DATABASE_URL_TEST?.trim()) {
  throw new Error(
    "DATABASE_URL_TEST is unset, so the chromium-db project would skip itself. In CI that is a broken workflow: check the step env in .github/workflows/ci.yml.",
  );
}
test.skip(
  !process.env.DATABASE_URL_TEST?.trim(),
  "no DATABASE_URL_TEST: the owner's page is behind a real session",
);

test.use({ locale: "pl-PL" });
test.setTimeout(180_000);
test.describe.configure({ mode: "serial" });

let page: Page;
let identity: Identity;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ locale: "pl-PL" });
  identity = newIdentity();
  await registerAndVerify(page, identity);
  await logIn(page, identity);
  await completeOnboarding(page, identity);
});

test.afterAll(async () => {
  await page.close();
});

// Whether a reload would be questioned right now: the browser shows its
// dialog when the event is cancelled.
function unloadGuarded(): Promise<boolean> {
  return page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

const dialog = () => page.getByRole("alertdialog");

test("back while editing asks; staying keeps the form, leaving goes back", async () => {
  // Somewhere to go back to that does not bounce (the landing page sends a
  // signed-in owner to their own profile).
  await page.goto("/settings/account");
  await page.goto(`/${identity.handle}`);
  expect(await unloadGuarded()).toBe(false);

  await page.getByRole("button", { name: "Edytuj profil" }).click();
  await page.getByRole("button", { name: "Dodaj realizację" }).click();
  await page.getByLabel("Nazwa", { exact: true }).fill("W toku");
  expect(await unloadGuarded()).toBe(true);

  await page.goBack();
  await expect(dialog()).toBeVisible();
  await expect(dialog()).toContainText("Opuścić stronę w trakcie edycji?");
  await page.getByRole("button", { name: "Zostań" }).click();
  await expect(dialog()).toHaveCount(0);
  // Still editing, the form and what was typed still there, same address.
  await expect(page.getByLabel("Nazwa", { exact: true })).toHaveValue("W toku");
  await expect(page).toHaveURL(new RegExp(`/${identity.handle}$`));

  await page.goBack();
  await expect(dialog()).toBeVisible();
  await page.getByRole("button", { name: "Wyjdź" }).click();
  await expect(page).toHaveURL(/\/settings\/account$/);
});

test("a link in the app while editing asks; leaving follows the link", async () => {
  await page.goto(`/${identity.handle}`);
  await page.getByRole("button", { name: "Edytuj profil" }).click();
  await page.getByRole("button", { name: "Menu konta" }).click();
  await page.getByRole("menuitem", { name: "Konto" }).click();
  await expect(dialog()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${identity.handle}$`));
  await page.getByRole("button", { name: "Wyjdź" }).click();
  await expect(page).toHaveURL(/\/settings\/account$/);
});

test("a refresh mid-edit (a work saved) keeps the guard: one Zostań, and Zapisz still clears it", async () => {
  await page.goto("/settings/account");
  await page.goto(`/${identity.handle}`);
  await page.getByRole("button", { name: "Edytuj profil" }).click();
  // Saving a work refreshes the page's data (router.refresh), which makes
  // Next rewrite the history entry's state — the guard must survive that.
  // The upload chain and the save are stubbed: the refresh is the point.
  const json = (body: unknown) => (route: import("@playwright/test").Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  await page.route(
    "**/api/uploads/presign",
    json({
      stagingKey: "staging/x/" + "a".repeat(32),
      uploadUrl: "/__stub-put",
    }),
  );
  await page.route("**/__stub-put", (route) =>
    route.fulfill({ status: 200, body: "" }),
  );
  await page.route(
    "**/api/uploads/confirm",
    json({ original: { fileId: "22222222-2222-4222-8222-222222222222" } }),
  );
  await page.route(
    "**/api/works",
    json({ id: "33333333-3333-4333-8333-333333333333" }),
  );
  try {
    await page.getByRole("button", { name: "Dodaj realizację" }).click();
    await page.getByLabel("Nazwa", { exact: true }).fill("Po odświeżeniu");
    const sharp = (await import("sharp")).default;
    await page.getByTestId("work-photos").setInputFiles({
      name: "r.png",
      mimeType: "image/png",
      buffer: await sharp({
        create: {
          width: 8,
          height: 8,
          channels: 3,
          background: { r: 1, g: 2, b: 3 },
        },
      })
        .png()
        .toBuffer(),
    });
    await expect(
      page.getByRole("button", { name: "Usuń zdjęcie" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Zapisz realizację" }).click();
    await expect(
      page.getByRole("heading", { name: "Nowa realizacja" }),
    ).toHaveCount(0);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }

  await page.goBack();
  await expect(dialog()).toBeVisible();
  await page.getByRole("button", { name: "Zostań" }).click();
  await expect(dialog()).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Zapisz", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${identity.handle}$`));
  // Once was enough: no second dialog lurking.
  await page.waitForTimeout(300);
  await expect(dialog()).toHaveCount(0);

  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edytuj profil" }),
  ).toBeVisible();
  await page.goBack();
  await expect(dialog()).toHaveCount(0);
  await expect(page).toHaveURL(/\/settings\/account$/);
});

test("ending editing with Zapisz leaves no guard: no dialog on reload, and back goes where it went", async () => {
  await page.goto("/settings/account");
  await page.goto(`/${identity.handle}`);
  await page.getByRole("button", { name: "Edytuj profil" }).click();
  expect(await unloadGuarded()).toBe(true);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edytuj profil" }),
  ).toBeVisible();
  expect(await unloadGuarded()).toBe(false);

  await page.goBack();
  await expect(dialog()).toHaveCount(0);
  await expect(page).toHaveURL(/\/settings\/account$/);
});

import { expect, test, type Page } from "@playwright/test";
import {
  completeOnboarding,
  logIn,
  newIdentity,
  registerAndVerify,
} from "./account";
import { seedWorks } from "./seed-works";

// #84: on a phone the back button is the gesture for "close this picture",
// and it used to leave the site. Opening the lightbox now pushes a history
// entry; back pops it and closes the picture, the page stays. Closing by
// the button (or Escape) pops that entry too, so the next back goes where
// it always went — one entry, never two.

if (process.env.CI && !process.env.DATABASE_URL_TEST?.trim()) {
  throw new Error(
    "DATABASE_URL_TEST is unset, so the chromium-db project would skip itself. In CI that is a broken workflow: check the step env in .github/workflows/ci.yml.",
  );
}
test.skip(
  !process.env.DATABASE_URL_TEST?.trim(),
  "no DATABASE_URL_TEST: a work needs a profile that exists",
);

test.use({ locale: "pl-PL" });
test.setTimeout(180_000);

const WORK = "Sala koncertowa";
let handle: string;
// The owner's own page, signed in, for the editing case at the end.
let owner: Page;

test.beforeAll(async ({ browser }) => {
  owner = await browser.newPage({ locale: "pl-PL" });
  const identity = newIdentity();
  handle = identity.handle;
  await registerAndVerify(owner, identity);
  await logIn(owner, identity);
  await completeOnboarding(owner, identity);
  await seedWorks(handle, [WORK]);
});

test.afterAll(async () => {
  await owner.close();
});

test("back closes the picture and stays on the profile; closing by the button leaves one entry, not two", async ({
  page,
}) => {
  // Somewhere to come back to, that a visitor can reach.
  await page.goto("/nie-ma-takiej-strony");
  await page.goto(`/${handle}`);
  const enlarge = page.getByRole("button", {
    name: `Powiększ zdjęcie 1 z 1: ${WORK}`,
  });
  const picture = page.getByRole("dialog");

  await enlarge.click();
  await expect(picture).toBeVisible();
  await page.goBack();
  await expect(picture).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/${handle}$`));

  // Closed by the button: the entry goes with it, and back leaves the page.
  await enlarge.click();
  await expect(picture).toBeVisible();
  await page.getByRole("button", { name: "Zamknij podgląd" }).click();
  await expect(picture).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/${handle}$`));
  await page.goBack();
  await expect(page).toHaveURL(/\/nie-ma-takiej-strony$/);
});

test("Escape closes it the same way, and opening twice pushes one entry each time", async ({
  page,
}) => {
  await page.goto("/nie-ma-takiej-strony");
  await page.goto(`/${handle}`);
  const enlarge = page.getByRole("button", {
    name: `Powiększ zdjęcie 1 z 1: ${WORK}`,
  });
  const picture = page.getByRole("dialog");
  const depth = () => page.evaluate(() => window.history.length);
  const before = await depth();

  await enlarge.click();
  await expect(picture).toBeVisible();
  expect(await depth()).toBe(before + 1);
  await page.keyboard.press("Escape");
  await expect(picture).toHaveCount(0);

  await enlarge.click();
  await expect(picture).toBeVisible();
  // Back replaced the popped entry: still one above the page, not two.
  expect(await depth()).toBe(before + 1);
  await page.goBack();
  await expect(picture).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/nie-ma-takiej-strony$/);
});

test("while editing, back closes the picture without the leave dialog (#83); the next back asks", async () => {
  await owner.goto("/settings/account");
  await owner.goto(`/${handle}`);
  await owner.getByRole("button", { name: "Edytuj profil" }).click();
  await owner
    .getByRole("button", { name: `Powiększ zdjęcie 1 z 1: ${WORK}` })
    .click();
  await expect(owner.getByRole("dialog")).toBeVisible();

  await owner.goBack();
  await expect(owner.getByRole("dialog")).toHaveCount(0);
  await expect(owner.getByRole("alertdialog")).toHaveCount(0);
  await expect(
    owner.getByRole("button", { name: "Zapisz", exact: true }),
  ).toBeVisible();

  await owner.goBack();
  await expect(owner.getByRole("alertdialog")).toBeVisible();
  await owner.getByRole("button", { name: "Zostań" }).click();
  await expect(owner.getByRole("alertdialog")).toHaveCount(0);
  await expect(owner).toHaveURL(new RegExp(`/${handle}$`));
});

import { expect, test, type Page } from "@playwright/test";
import {
  completeOnboarding,
  logIn,
  newIdentity,
  registerAndVerify,
  type Identity,
} from "./account";

// #72 / A12, step 2: the headline, the places and the bio, edited in place
// on the owner's page and read back on the visitor's. The avatar suite
// covers the upload wiring on the same screen; this one covers the
// save-on-blur contract — a field saves when it is left, "Zapisz" only
// closes the editing chrome — and that what the owner typed is what a
// signed-out visitor sees, paragraph breaks included.

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

const HEADLINE = "Wizualizacje dla deweloperów. Warszawa i cała Polska.";
const BIO = "Pierwszy akapit o pracowni.\n\nDrugi akapit, po pustej linii.";

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

test("the owner fills the headline, a place from the list, a typed place and the bio, each saved on blur", async () => {
  await page.goto(`/${identity.handle}`);
  await page.getByRole("button", { name: "Edytuj profil" }).click();

  const headline = page.getByLabel("Nagłówek");
  await headline.fill(HEADLINE);
  // The counter follows the field, and stays quiet this far from the limit.
  await expect(page.getByText(`${HEADLINE.length} / 220`)).toBeVisible();
  await headline.blur();

  // A TERYT suggestion: typing without diacritics finds the city; choosing
  // it adds the chip and clears the field for the next one.
  const place = page.getByRole("combobox", { name: "Dodaj miejsce" });
  await place.fill("warsz");
  const suggestion = page.getByRole("option", { name: /^Warszawa/ });
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await expect(page.getByText("Warszawa", { exact: true })).toBeVisible();
  await expect(place).toHaveValue("");

  // Free text, which the list does not know: Enter adds it as typed.
  await place.fill("cała Polska");
  await place.press("Enter");
  await expect(page.getByText("cała Polska", { exact: true })).toBeVisible();

  // The same place again is refused with a reason, not silently dropped.
  await place.fill("Warszawa");
  await place.press("Enter");
  await expect(page.getByText("To miejsce już jest na liście.")).toBeVisible();

  const bio = page.getByLabel("Bio");
  await bio.fill(BIO);
  await bio.blur();

  // "Zapisz" closes the editing chrome; the page then shows the server's
  // copy, which is what proves the blurs saved.
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisano profil")).toBeVisible();
  await expect(page.getByText(HEADLINE)).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByText(HEADLINE)).toBeVisible();
  await expect(page.getByText("Warszawa", { exact: true })).toBeVisible();
  await expect(page.getByText("cała Polska", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Siedziba i obszar działania" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "O nas" })).toBeVisible();
});

test("removing a chip saves at once, and an emptied headline disappears from the page", async () => {
  await page.goto(`/${identity.handle}`);
  await page.getByRole("button", { name: "Edytuj profil" }).click();
  await page.getByRole("button", { name: "Usuń cała Polska" }).click();
  await expect(page.getByText("cała Polska", { exact: true })).toHaveCount(0);

  const headline = page.getByLabel("Nagłówek");
  await headline.fill("");
  await headline.blur();
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  // View mode again, with the emptied headline gone and the removed chip
  // absent — proof the saves landed before the page is reloaded.
  await expect(page.getByText("Zapisano profil")).toBeVisible();
  await expect(page.getByLabel("Nagłówek")).toHaveCount(0);
  await expect(page.getByText(HEADLINE)).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(HEADLINE)).toHaveCount(0);
  await expect(page.getByText("Warszawa", { exact: true })).toBeVisible();
  await expect(page.getByText("cała Polska", { exact: true })).toHaveCount(0);
});

test("a signed-out visitor reads the sections, with the bio's paragraphs kept and the headline in the description", async ({
  browser,
}) => {
  // Put the headline back first, so the visitor's page has every section.
  await page.goto(`/${identity.handle}`);
  await page.getByRole("button", { name: "Edytuj profil" }).click();
  const headline = page.getByLabel("Nagłówek");
  await headline.fill(HEADLINE);
  await headline.blur();
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText(HEADLINE)).toBeVisible({ timeout: 15_000 });

  const visitor = await browser.newPage({ locale: "pl-PL" });
  try {
    await visitor.goto(`/${identity.handle}`);
    await expect(
      visitor.getByRole("heading", { level: 1, name: identity.displayName }),
    ).toBeVisible();
    await expect(visitor.getByText(HEADLINE)).toBeVisible();
    await expect(visitor.getByText("Warszawa", { exact: true })).toBeVisible();
    // Two paragraphs, one element: the break is white-space, not markup.
    const bioText = visitor.getByText("Pierwszy akapit o pracowni.");
    await expect(bioText).toContainText("Drugi akapit, po pustej linii.");
    await expect(bioText).toHaveCSS("white-space", "pre-line");
    // No editing chrome for a visitor.
    await expect(
      visitor.getByRole("button", { name: "Edytuj profil" }),
    ).toHaveCount(0);
    // A7: the headline is the page's description and the share card's.
    await expect(visitor.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      HEADLINE,
    );
    await expect(
      visitor.locator('meta[property="og:description"]'),
    ).toHaveAttribute("content", HEADLINE);
  } finally {
    await visitor.close();
  }
});

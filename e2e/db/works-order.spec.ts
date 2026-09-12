import { expect, test, type Page } from "@playwright/test";
import {
  completeOnboarding,
  logIn,
  newIdentity,
  registerAndVerify,
  type Identity,
} from "./account";
import { seedWorks } from "./seed-works";

// #66: the owner drags a work to the front of their profile and it stays
// there — for them and for a visitor. Both hands are covered, because they
// are different code paths: the pointer (which is what a finger does too)
// and the arrow keys on the same grip, which is the whole of the feature for
// anyone not using a mouse.

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

const FIRST = "Osiedle nad rzeką";
const SECOND = "Biurowiec przy rondzie";
const THIRD = "Dom w lesie";

let page: Page;
let identity: Identity;

/**
 * The work names as the page lists them, top to bottom — as a retrying
 * assertion, not a snapshot. Reading the names straight after a key press
 * asks the page what it looks like before React has finished putting it
 * there: green on a quiet machine, red about one run in three on CI, and the
 * difference is not the product.
 */
function namesOn(target: Page) {
  return expect(target.locator("article h3"));
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ locale: "pl-PL" });
  identity = newIdentity();
  await registerAndVerify(page, identity);
  await logIn(page, identity);
  await completeOnboarding(page, identity);
  await seedWorks(identity.handle, [FIRST, SECOND, THIRD]);
});

test.afterAll(async () => {
  await page.close();
});

test("the grips appear only while editing", async () => {
  await page.goto(`/${identity.handle}`);
  await namesOn(page).toHaveText([FIRST, SECOND, THIRD]);
  await expect(
    page.getByRole("button", { name: /^Przesuń realizację/ }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Edytuj profil" }).click();
  await expect(
    page.getByRole("button", { name: /^Przesuń realizację/ }),
  ).toHaveCount(3);
});

test("the arrow keys on a grip move a work, and the order survives a reload", async () => {
  const last = page.getByRole("button", {
    name: `Przesuń realizację ${THIRD}`,
  });
  await last.focus();
  // The order is saved as it is dragged, so the request is part of the
  // behaviour: a green screen and a silent server is the failure this test
  // exists to catch.
  const saved = page.waitForResponse((response) =>
    response.url().includes("/api/works/order"),
  );
  await page.keyboard.press("ArrowUp");
  expect((await saved).status()).toBe(200);
  // Said out loud, for a screen reader: the cards moving is the only other
  // sign that anything happened.
  await expect(
    page.getByText(`Realizacja ${THIRD} jest teraz na pozycji 2`),
  ).toHaveCount(1);
  await namesOn(page).toHaveText([FIRST, THIRD, SECOND]);
  // The keyboard stays on the work it moved, or a second press would move
  // whatever took its place.
  const savedAgain = page.waitForResponse((response) =>
    response.url().includes("/api/works/order"),
  );
  await page.keyboard.press("ArrowUp");
  await namesOn(page).toHaveText([THIRD, FIRST, SECOND]);
  // Waited for before the reload, not out of tidiness: the order is sent
  // once the moving stops, so a reload racing that timer would cancel the
  // request in flight and the test would be about the wrong thing.
  expect((await savedAgain).status()).toBe(200);

  await page.reload();
  await namesOn(page).toHaveText([THIRD, FIRST, SECOND]);
});

test("a work dragged by its grip lands where it was dropped", async () => {
  await page.getByRole("button", { name: "Edytuj profil" }).click();
  const grip = page.getByRole("button", {
    name: `Przesuń realizację ${SECOND}`,
  });
  // Both ends of the drag have to be on screen at the same time: the mouse
  // is moved in viewport coordinates, and a card below the fold would be
  // dragged at a point the page never sees.
  await grip.scrollIntoViewIfNeeded();
  const first = page.locator("article").first();
  const from = await grip.boundingBox();
  const onto = await first.boundingBox();
  if (!from || !onto) throw new Error("no layout to drag over");

  const saved = page.waitForResponse((response) =>
    response.url().includes("/api/works/order"),
  );
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // In steps, as a hand does: the frames in between are where a hand-rolled
  // drag tends to lose its grip.
  await page.mouse.move(onto.x + onto.width / 2, onto.y + onto.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  expect((await saved).status()).toBe(200);

  await namesOn(page).toHaveText([SECOND, THIRD, FIRST]);
  await page.reload();
  await namesOn(page).toHaveText([SECOND, THIRD, FIRST]);
});

test("a visitor sees the owner's order", async ({ browser }) => {
  const visitor = await browser.newPage({ locale: "pl-PL" });
  try {
    await visitor.goto(`/${identity.handle}`);
    await namesOn(visitor).toHaveText([SECOND, THIRD, FIRST]);
    // Nothing to take hold of on someone else's profile.
    await expect(
      visitor.getByRole("button", { name: /^Przesuń realizację/ }),
    ).toHaveCount(0);
  } finally {
    await visitor.close();
  }
});

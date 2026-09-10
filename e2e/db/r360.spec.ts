import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "../axe";
import {
  completeOnboarding,
  logIn,
  newIdentity,
  registerAndVerify,
  type Identity,
} from "./account";
import { seedWorks } from "./seed-works";

// #104 (A13): the visitor's side of an R360. A work with a 4-frame set is
// seeded straight into the database (its frames have no objects behind
// them — the pictures 404, which is exactly the state before any frame
// loads); the public page shows the start frame server-side as the
// poster, and the orbit turns by drag and by keyboard from there.

if (process.env.CI && !process.env.DATABASE_URL_TEST?.trim()) {
  throw new Error(
    "DATABASE_URL_TEST is unset, so the chromium-db project would skip itself. In CI that is a broken workflow: check the step env in .github/workflows/ci.yml.",
  );
}
test.skip(
  !process.env.DATABASE_URL_TEST?.trim(),
  "no DATABASE_URL_TEST: the public page needs a seeded profile",
);

test.use({ locale: "pl-PL" });
test.setTimeout(180_000);

let identity: Identity;
let visitor: Page;

test.beforeAll(async ({ browser }) => {
  const owner = await (await browser.newContext({ locale: "pl-PL" })).newPage();
  identity = newIdentity();
  await registerAndVerify(owner, identity);
  await logIn(owner, identity);
  await completeOnboarding(owner, identity);
  await owner.context().close();
  await seedWorks(identity.handle, [
    { name: "Dom na skarpie", r360: { frameCount: 4, startFrame: 3 } },
    // #123 needs a set where "every 8th frame" and "all of them" differ:
    // sixteen frames is a coarse tier of two.
    { name: "Panorama", r360: { frameCount: 16, startFrame: 1 } },
  ]);
  // A visitor: a context of its own, no session.
  visitor = await (await browser.newContext({ locale: "pl-PL" })).newPage();
});

test.afterAll(async () => {
  await visitor.context().close();
});

async function dragAcross(page: Page, fraction: number) {
  const viewer = page.getByTestId("orbit-viewer").first();
  await viewer.scrollIntoViewIfNeeded();
  const box = await viewer.boundingBox();
  if (!box) throw new Error("no viewer box");
  const y = box.y + box.height / 2;
  const from = box.x + box.width * 0.25;
  await page.mouse.move(from, y);
  await page.mouse.down();
  await page.mouse.move(from + box.width * fraction, y, { steps: 4 });
  await page.mouse.up();
}

test("the public page shows the start frame server-side as the poster, marked 360°", async () => {
  // No script at all: what a crawler and a slow phone get first.
  const bare = await visitor.context().browser()!.newContext({
    locale: "pl-PL",
    javaScriptEnabled: false,
  });
  const page = await bare.newPage();
  await page.goto(`/${identity.handle}`);
  const poster = page.getByTestId("orbit-viewer").locator("img");
  await expect(poster).toHaveAttribute(
    "src",
    // CI has no bucket: the base is empty there and the address is the key
    // alone. The width and the ordinal are what the poster proves.
    /(^|\/)800\/003\.webp$/,
  );
  await expect(poster).toHaveAttribute("alt", "Dom na skarpie, widok 360°");
  await expect(page.getByText("360°", { exact: true })).toBeVisible();
  // No archive is mentioned to a visitor.
  await expect(page.getByText("R360 wgrany")).toHaveCount(0);
  await bare.close();
});

test("a drag by half the width at k = 2 turns one frame; past the last frame it wraps; arrows and Home work; axe passes", async () => {
  await visitor.goto(`/${identity.handle}`);
  const viewer = visitor.getByTestId("orbit-viewer").first();
  await expect(viewer).toHaveAttribute("data-frame", "3");
  await expect(viewer).toHaveAttribute("aria-valuetext", "Klatka 3 z 4");
  // k = round(4 / 2) = 2: half the width is one frame.
  await dragAcross(visitor, 0.5);
  await expect(viewer).toHaveAttribute("data-frame", "4");
  // Past the last frame: the orbit wraps to the first.
  await dragAcross(visitor, 0.5);
  await expect(viewer).toHaveAttribute("data-frame", "1");
  // The frames never loaded (no objects behind the seed): the poster
  // stands in for every frame meanwhile.
  await expect(viewer.locator("img")).toHaveAttribute("src", /\/003\.webp$/);

  await viewer.focus();
  await visitor.keyboard.press("ArrowRight");
  await expect(viewer).toHaveAttribute("data-frame", "2");
  await visitor.keyboard.press("ArrowLeft");
  await visitor.keyboard.press("ArrowLeft");
  await expect(viewer).toHaveAttribute("data-frame", "4");
  await visitor.keyboard.press("Home");
  await expect(viewer).toHaveAttribute("data-frame", "3");
  await visitor.keyboard.press("End");
  await expect(viewer).toHaveAttribute("data-frame", "1");

  await expectNoAxeViolations(visitor, test.info(), "public-r360-card");
});

test("a tap on the ring's centre falls through to the picture, and a reduced-motion visitor jumps rather than travels (#106)", async () => {
  const still = await visitor.context().browser()!.newContext({
    locale: "pl-PL",
    reducedMotion: "reduce",
  });
  const page = await still.newPage();
  await page.goto(`/${identity.handle}`);
  const viewer = page.getByTestId("orbit-viewer").first();
  const ring = page.getByTestId("orbit-ring").first().locator("svg");
  await ring.scrollIntoViewIfNeeded();
  const box = await ring.boundingBox();
  if (!box) throw new Error("no ring box");
  // The centre is not the ring's: a press there is the picture's drag,
  // which without movement changes nothing.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(viewer).toHaveAttribute("data-frame", "3");
  // On the band, opposite the dot: a jump, no frames on the way.
  await page.mouse.click(
    box.x + (box.width * (100 + 92)) / 200,
    box.y + box.height / 2,
  );
  await expect(viewer).toHaveAttribute("data-frame", "2");
  await still.close();
});

test("a click on the ring travels the shorter arc to the frame at that angle (#106)", async () => {
  await visitor.goto(`/${identity.handle}`);
  const viewer = visitor.getByTestId("orbit-viewer").first();
  await expect(viewer).toHaveAttribute("data-frame", "3");
  const ring = visitor.getByTestId("orbit-ring").first().locator("svg");
  await ring.scrollIntoViewIfNeeded();
  const box = await ring.boundingBox();
  if (!box) throw new Error("no ring box");
  // The ring's view box is 200 wide with a 92 px radius: from the start
  // frame (3, at the bottom) the frames go clockwise on screen — 4 on the
  // left, 1 at the top, 2 on the right.
  const right = {
    x: box.x + (box.width * (100 + 92)) / 200,
    y: box.y + box.height / 2,
  };
  await visitor.mouse.click(right.x, right.y);
  await expect(viewer).toHaveAttribute("data-frame", "2");
  await expect(visitor.getByTestId("orbit-counter").first()).toHaveText(
    "2 / 4",
  );
  const left = {
    x: box.x + (box.width * (100 - 92)) / 200,
    y: box.y + box.height / 2,
  };
  await visitor.mouse.click(left.x, left.y);
  await expect(viewer).toHaveAttribute("data-frame", "4");
});

test("the enlarge button opens the orbit in the lightbox, where it turns too; Escape closes it", async () => {
  await visitor.goto(`/${identity.handle}`);
  await visitor
    .getByRole("button", { name: "Powiększ widok 360°: Dom na skarpie" })
    .click();
  const dialog = visitor.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const enlarged = dialog.getByTestId("orbit-viewer");
  await expect(enlarged).toHaveAttribute("data-frame", "3");
  await expect(dialog.getByText("1 / 1")).toBeVisible();
  await enlarged.focus();
  await visitor.keyboard.press("ArrowRight");
  await expect(enlarged).toHaveAttribute("data-frame", "4");
  await expectNoAxeViolations(visitor, test.info(), "public-r360-lightbox");
  await visitor.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

// #123: the card used to stop at every 8th frame until a pointer, a key or
// focus arrived. With 120 frames that is fifteen of them, so a drag moved
// the picture in jumps of eight while the ring's arc said the frames were
// there — reported by Dawid on the #139 preview, 10.09.2026. An orbit in
// view now loads its whole set. Nothing here touches the orbit: no click,
// no drag, no focus, no key.
test("an orbit that is merely in view loads all of its frames, untouched", async () => {
  const page = await visitor.context().newPage();
  const askedBySet = new Map<string, Set<string>>();
  page.on("request", (request) => {
    const at = request.url().match(/\/r360\/([0-9a-f]+)\/800\/(\d{3})\.webp$/);
    if (!at) return;
    const asked = askedBySet.get(at[1]) ?? new Set<string>();
    asked.add(at[2]);
    askedBySet.set(at[1], asked);
  });
  await page.goto(`/${identity.handle}`);
  await page.getByTestId("orbit-viewer").last().scrollIntoViewIfNeeded();
  // Sixteen, not the coarse two. The poll is what waits: the frames go
  // through one queue for the page, a few requests at a time.
  await expect
    .poll(() => Math.max(0, ...[...askedBySet.values()].map((s) => s.size)), {
      timeout: 60_000,
    })
    .toBe(16);
  await page.close();
});

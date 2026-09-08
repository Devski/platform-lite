import {
  expect,
  test,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";
import {
  completeOnboarding,
  logIn,
  newIdentity,
  registerAndVerify,
  type Identity,
} from "./account";
import { seedWorks } from "./seed-works";

// #72 / A12, step 4: the work form's wiring from the browser's side, every
// server answer stubbed — which calls it makes, with what, and which it does
// not (the avatar suite's method). The library behind /api/works is proven
// on PGlite in src/lib/works.test.ts; a real end-to-end add needs a bucket,
// which CI has not.

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

const UPLOAD_URL = "/__stub-storage/staged-work";
const STAGING_KEY = "staging/someone/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FILE_ID = "22222222-2222-4222-8222-222222222222";
const ARCHIVE_ID = "44444444-4444-4444-8444-444444444444";

const json = (status: number, body: unknown) => (route: Route) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

async function pngBytes(seed = 10): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 200, g: 120, b: seed },
    },
  })
    .png()
    .toBuffer();
}

// A picked file, distinct bytes per seed so the form does not take two for
// one (it dedupes by the id the server answers with).
async function pngFile(name: string, seed: number) {
  return { name, mimeType: "image/png", buffer: await pngBytes(seed) };
}

// The ids the confirm stub hands out, one per upload, in order.
const fileIdAt = (n: number) =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;

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

test.beforeEach(async () => {
  await page.goto(`/${identity.handle}`);
  await page.getByRole("button", { name: "Edytuj profil" }).click();
  await page.getByRole("button", { name: "Dodaj realizację" }).click();
  await expect(
    page.getByRole("heading", { name: "Nowa realizacja" }),
  ).toBeVisible();
  await page.route(
    "**/api/uploads/presign",
    json(200, { stagingKey: STAGING_KEY, uploadUrl: UPLOAD_URL }),
  );
  await page.route(`**${UPLOAD_URL}`, (route) =>
    route.fulfill({ status: 200, body: "" }),
  );
});

test.afterEach(async () => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("a new work: the photo goes through the upload chain as a work, then the form posts the work with that photo as main", async () => {
  const confirmRequests: Request[] = [];
  const created: Request[] = [];
  await page.route("**/api/uploads/confirm", (route) => {
    confirmRequests.push(route.request());
    return json(200, { original: { fileId: FILE_ID } })(route);
  });
  await page.route("**/api/works", (route) => {
    created.push(route.request());
    return json(200, { id: "33333333-3333-4333-8333-333333333333" })(route);
  });

  // Saving without a name or a photo is refused on the page, with a reason.
  await page.getByRole("button", { name: "Zapisz realizację" }).click();
  await expect(page.getByText("Podaj nazwę realizacji.")).toBeVisible();
  await page
    .getByLabel("Nazwa", { exact: true })
    .fill("Osiedle Nowe Żerniki, etap II");
  await page.getByRole("button", { name: "Zapisz realizację" }).click();
  await expect(
    page.getByText("Dodaj przynajmniej jedno zdjęcie."),
  ).toBeVisible();
  expect(created).toHaveLength(0);

  await page.getByTestId("work-photos").setInputFiles({
    name: "render.png",
    mimeType: "image/png",
    buffer: await pngBytes(),
  });
  await expect.poll(() => confirmRequests.length).toBe(1);
  expect(confirmRequests[0].postDataJSON()).toEqual({
    stagingKey: STAGING_KEY,
    purpose: "work",
  });
  // The first photo is the main one, and says so.
  await expect(page.getByText("Główne", { exact: true })).toBeVisible();

  // The R360 archive: its own presign and confirm, never a read by the
  // server; the form then names the confirmed file on the work.
  const archivePresigns: Request[] = [];
  const archiveConfirms: Request[] = [];
  await page.route("**/api/uploads/presign-archive", (route) => {
    archivePresigns.push(route.request());
    return json(200, { stagingKey: STAGING_KEY, uploadUrl: UPLOAD_URL })(route);
  });
  await page.route("**/api/uploads/confirm-archive", (route) => {
    archiveConfirms.push(route.request());
    return json(200, { fileId: ARCHIVE_ID, sizeBytes: 3 })(route);
  });
  await page.getByTestId("work-r360").setInputFiles({
    name: "orbit.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("PK\u0003"),
  });
  await expect(page.getByText("Wgrany", { exact: true })).toBeVisible();
  expect(archivePresigns[0].postDataJSON()).toEqual({
    sizeBytes: 3,
    contentType: "application/zip",
  });
  expect(archiveConfirms[0].postDataJSON()).toEqual({
    stagingKey: STAGING_KEY,
  });

  await page.getByLabel("Inwestor").fill("Archicom S.A.");
  await page.getByRole("button", { name: "Zapisz realizację" }).click();
  await expect.poll(() => created.length).toBe(1);
  expect(created[0].postDataJSON()).toEqual({
    name: "Osiedle Nowe Żerniki, etap II",
    investor: "Archicom S.A.",
    developer: "",
    imageFileIds: [FILE_ID],
    r360FileId: ARCHIVE_ID,
  });
  // Saved: the form folds away.
  await expect(
    page.getByRole("heading", { name: "Nowa realizacja" }),
  ).toHaveCount(0);
});

test("several at once (#79): the picker takes what fits and says so, replace keeps the tile's place", async () => {
  // Uploads run in parallel, so the id is pinned to the upload at presign
  // (the presigns leave in pick order, synchronously) and confirm reads it
  // back from the staging key — whichever confirm lands first.
  let uploads = 0;
  const discarded: Request[] = [];
  const created: Request[] = [];
  await page.route("**/api/uploads/presign", (route) =>
    json(200, {
      stagingKey: `staging/someone/${String(++uploads).repeat(32)}`,
      uploadUrl: UPLOAD_URL,
    })(route),
  );
  await page.route("**/api/uploads/confirm", (route) => {
    const n = Number(String(route.request().postDataJSON().stagingKey).at(-1));
    return json(200, {
      original: { fileId: fileIdAt(n) },
      variants: [{ kind: "work-480", url: `/__stub-storage/thumb-${n}.webp` }],
    })(route);
  });
  // The tile switches to the server's 480 px variant once confirmed: serve
  // one so the switch can be seen, not just the request for it.
  await page.route("**/__stub-storage/thumb-*", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: await pngBytes(7),
    }),
  );
  await page.route("**/api/uploads/discard", (route) => {
    discarded.push(route.request());
    return json(200, { ok: true })(route);
  });
  await page.route("**/api/works", (route) => {
    created.push(route.request());
    return json(200, { id: "33333333-3333-4333-8333-333333333333" })(route);
  });
  const picker = page.getByTestId("work-photos");
  const removeButtons = page.getByRole("button", { name: "Usuń zdjęcie" });
  // Many while two or more fit, one for the last place.
  await expect(picker).toHaveAttribute("multiple", "");

  // One file first: one chain, one tile, the tile switched to the server's
  // 480 px variant once confirmed.
  await picker.setInputFiles([await pngFile("a.png", 1)]);
  await expect(removeButtons).toHaveCount(1);
  await expect(page.getByText("1 / 3")).toBeVisible();
  await expect(page.locator("form img").first()).toHaveAttribute(
    "src",
    "/__stub-storage/thumb-1.webp",
  );

  // Three files when two fit: two go up in parallel, the owner is told,
  // and the "+" tile is gone once the work is full.
  await picker.setInputFiles([
    await pngFile("b.png", 2),
    await pngFile("c.png", 3),
    await pngFile("d.png", 4),
  ]);
  await expect(
    page.getByText("Zmieściło się 2 z 3: realizacja ma najwyżej 3 zdjęcia."),
  ).toBeVisible();
  await expect(removeButtons).toHaveCount(3);
  expect(uploads).toBe(3);
  await expect(picker).toHaveCount(0);
  await expect(
    page.getByText(
      "Komplet: 3 zdjęcia. Żeby dodać inne, usuń któreś albo je wymień.",
    ),
  ).toBeVisible();

  // With one place left the picker is single-file: a phone's gallery then
  // cannot offer seven for one.
  await removeButtons.nth(2).click();
  await expect.poll(() => discarded.length).toBe(1);
  expect(discarded[0].postDataJSON()).toEqual({ fileId: fileIdAt(3) });
  await expect(removeButtons).toHaveCount(2);
  await expect(picker).not.toHaveAttribute("multiple");
  await picker.setInputFiles(await pngFile("c.png", 3));
  await expect(removeButtons).toHaveCount(3);

  // Replace the main photo: the new one is main, the old one discarded.
  await page
    .getByTestId("work-photo-replace-0")
    .setInputFiles(await pngFile("f.png", 6));
  await expect.poll(() => uploads).toBe(5);
  await expect.poll(() => discarded.length).toBe(2);
  expect(discarded[1].postDataJSON()).toEqual({ fileId: fileIdAt(1) });
  await expect(removeButtons).toHaveCount(3);

  await page.getByLabel("Nazwa", { exact: true }).fill("Trzy ujęcia");
  await page.getByRole("button", { name: "Zapisz realizację" }).click();
  await expect.poll(() => created.length).toBe(1);
  expect(created[0].postDataJSON()).toEqual({
    name: "Trzy ujęcia",
    investor: "",
    developer: "",
    imageFileIds: [fileIdAt(5), fileIdAt(2), fileIdAt(4)],
    r360FileId: null,
  });
  await expect(
    page.getByRole("heading", { name: "Nowa realizacja" }),
  ).toHaveCount(0);
});

test("the page's Zapisz waits for the archive, then saves the open form (#85)", async () => {
  const created: Request[] = [];
  await page.route(
    "**/api/uploads/confirm",
    json(200, { original: { fileId: FILE_ID } }),
  );
  await page.route("**/api/works", (route) => {
    created.push(route.request());
    return json(200, { id: "33333333-3333-4333-8333-333333333333" })(route);
  });
  // The archive's PUT is held open until the test lets it through: what
  // "Zapisz" does in the meantime is the point.
  const archiveUrl = "/__stub-storage/staged-archive";
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**${archiveUrl}`, async (route) => {
    await held;
    await route.fulfill({ status: 200, body: "" });
  });
  await page.route(
    "**/api/uploads/presign-archive",
    json(200, { stagingKey: STAGING_KEY, uploadUrl: archiveUrl }),
  );
  await page.route(
    "**/api/uploads/confirm-archive",
    json(200, { fileId: ARCHIVE_ID, sizeBytes: 3 }),
  );

  await page.getByLabel("Nazwa", { exact: true }).fill("Z orbitą");
  await page
    .getByTestId("work-photos")
    .setInputFiles(await pngFile("a.png", 1));
  await expect(
    page.getByRole("button", { name: "Usuń zdjęcie" }),
  ).toBeVisible();
  await page.getByTestId("work-r360").setInputFiles({
    name: "orbit.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("PK\u0003"),
  });

  // Zapisz in the top bar: waits, says so, posts nothing yet.
  const save = page.getByRole("button", { name: "Zapisywanie…" });
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(save).toBeVisible();
  await expect(save).toBeDisabled();
  await page.waitForTimeout(300);
  expect(created).toHaveLength(0);
  await expect(
    page.getByRole("heading", { name: "Nowa realizacja" }),
  ).toBeVisible();

  release();
  await expect.poll(() => created.length).toBe(1);
  expect(created[0].postDataJSON()).toEqual({
    name: "Z orbitą",
    investor: "",
    developer: "",
    imageFileIds: [FILE_ID],
    r360FileId: ARCHIVE_ID,
  });
  // The form is saved and gone, and editing has ended.
  await expect(
    page.getByRole("heading", { name: "Nowa realizacja" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edytuj profil" }),
  ).toBeVisible();
});

test("Zapisz keeps editing when the open form cannot be saved, and closes an untouched one (#85)", async () => {
  let created = false;
  await page.route(
    "**/api/uploads/confirm",
    json(200, { original: { fileId: FILE_ID } }),
  );
  await page.route("**/api/works", (route) => {
    created = true;
    return json(200, {})(route);
  });
  // A photo but no name: not savable, not empty.
  await page
    .getByTestId("work-photos")
    .setInputFiles(await pngFile("a.png", 1));
  await expect(
    page.getByRole("button", { name: "Usuń zdjęcie" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Podaj nazwę realizacji.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zapisz", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Nazwa", { exact: true })).toBeFocused();
  expect(created).toBe(false);

  // Emptied again (the photo removed, its discard answered here): Zapisz
  // closes it and ends editing.
  await page.route("**/api/uploads/discard", json(200, { ok: true }));
  await page.getByRole("button", { name: "Usuń zdjęcie" }).click();
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nowa realizacja" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edytuj profil" }),
  ).toBeVisible();
  expect(created).toBe(false);
});

test("cancelling after an upload discards the orphan photo, and posts no work", async () => {
  const discarded: Request[] = [];
  let created = false;
  await page.route(
    "**/api/uploads/confirm",
    json(200, { original: { fileId: FILE_ID } }),
  );
  await page.route("**/api/uploads/discard", (route) => {
    discarded.push(route.request());
    return json(200, { ok: true })(route);
  });
  await page.route("**/api/works", (route) => {
    created = true;
    return json(200, {})(route);
  });

  await page.getByTestId("work-photos").setInputFiles({
    name: "render.png",
    mimeType: "image/png",
    buffer: await pngBytes(),
  });
  await expect(page.getByText("Główne", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Anuluj" }).click();

  await expect.poll(() => discarded.length).toBe(1);
  expect(discarded[0].postDataJSON()).toEqual({ fileId: FILE_ID });
  expect(created).toBe(false);
  await expect(
    page.getByRole("heading", { name: "Nowa realizacja" }),
  ).toHaveCount(0);
  // With no works, the owner sees how to start.
  await expect(page.getByText("Jeszcze bez realizacji")).toBeVisible();
});

// Last: the works it seeds stay, and the empty state above must have been seen first.
test("editing a work puts its form where its card was (#86); cancel and save put the card back there", async () => {
  // Two works that exist: the list is the point, so they go straight into
  // the database (a browser-driven add needs a bucket).
  const [first, second] = await seedWorks(identity.handle, [
    "Pierwsza realizacja",
    "Druga realizacja",
  ]);
  // Editing is on (beforeEach), so the #83 guard arms beforeunload and a
  // reload would ask first — on the CI runner that reload never came back.
  // Leave editing first (the untouched form just closes), then reload.
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edytuj profil" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Edytuj profil" }).click();
  const items = page
    .locator("section", {
      has: page.getByRole("heading", { name: "Realizacje" }),
    })
    .locator("ul > li");
  await expect(items).toHaveCount(2);

  await page.getByRole("button", { name: `Edytuj: ${second.name}` }).click();
  // Still two list items: the first card, and the form in the second's
  // place — no third card, no form above the list.
  await expect(items).toHaveCount(2);
  await expect(
    items.nth(1).getByRole("heading", { name: "Edytuj realizację" }),
  ).toBeVisible();
  await expect(items.nth(1).getByLabel("Nazwa", { exact: true })).toHaveValue(
    second.name,
  );
  await expect(
    items.nth(0).getByRole("heading", { level: 3, name: first.name }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: second.name }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Nowa realizacja" }),
  ).toHaveCount(0);

  // Switching to the first: one form at a time, again in place.
  await page.getByRole("button", { name: `Edytuj: ${first.name}` }).click();
  await expect(items.nth(0).getByLabel("Nazwa", { exact: true })).toHaveValue(
    first.name,
  );
  await expect(
    items.nth(1).getByRole("heading", { level: 3, name: second.name }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Anuluj" }).click();
  await expect(
    items.nth(0).getByRole("heading", { level: 3, name: first.name }),
  ).toBeVisible();
  // Focus is back on the button that opened the form.
  await expect(
    page.getByRole("button", { name: `Edytuj: ${first.name}` }),
  ).toBeFocused();

  // A save: the form posts the rename with the photo as it was, and the
  // card comes back in the same place. The PATCH is answered here — the
  // works routes need a bucket the CI runner has not; the library behind
  // them is proven in src/lib/works.test.ts.
  const patched: Request[] = [];
  await page.route(`**/api/works/${second.id}`, (route) => {
    patched.push(route.request());
    return json(200, { ok: true })(route);
  });
  await page.getByRole("button", { name: `Edytuj: ${second.name}` }).click();
  await items
    .nth(1)
    .getByLabel("Nazwa", { exact: true })
    .fill("Druga, po zmianie");
  await page.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect.poll(() => patched.length).toBe(1);
  expect(patched[0].method()).toBe("PATCH");
  expect(patched[0].postDataJSON()).toMatchObject({
    name: "Druga, po zmianie",
    imageFileIds: [expect.any(String)],
  });
  await expect(
    items.nth(1).getByRole("heading", { level: 3, name: second.name }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(items).toHaveCount(2);
});

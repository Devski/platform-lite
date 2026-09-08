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

  // Two files in one pick: two upload chains, two tiles, "2 / 3".
  await picker.setInputFiles([
    await pngFile("a.png", 1),
    await pngFile("b.png", 2),
  ]);
  await expect(removeButtons).toHaveCount(2);
  await expect(page.getByText("2 / 3")).toBeVisible();
  expect(uploads).toBe(2);
  await expect(page.locator("form img").first()).toHaveAttribute(
    "src",
    "/__stub-storage/thumb-1.webp",
  );

  // Three more when one fits: one goes up, the owner is told, and the
  // "+" tile is gone once the work is full.
  await picker.setInputFiles([
    await pngFile("c.png", 3),
    await pngFile("d.png", 4),
    await pngFile("e.png", 5),
  ]);
  await expect(
    page.getByText("Zmieściło się 1 z 3: realizacja ma najwyżej 3 zdjęcia."),
  ).toBeVisible();
  await expect(removeButtons).toHaveCount(3);
  expect(uploads).toBe(3);
  await expect(picker).toHaveCount(0);
  await expect(
    page.getByText(
      "Komplet: 3 zdjęcia. Żeby dodać inne, usuń któreś albo je wymień.",
    ),
  ).toBeVisible();

  // Replace the main photo: the new one is main, the old one discarded.
  await page
    .getByTestId("work-photo-replace-0")
    .setInputFiles(await pngFile("f.png", 6));
  await expect.poll(() => uploads).toBe(4);
  await expect.poll(() => discarded.length).toBe(1);
  expect(discarded[0].postDataJSON()).toEqual({ fileId: fileIdAt(1) });
  await expect(removeButtons).toHaveCount(3);

  await page.getByLabel("Nazwa", { exact: true }).fill("Trzy ujęcia");
  await page.getByRole("button", { name: "Zapisz realizację" }).click();
  await expect.poll(() => created.length).toBe(1);
  expect(created[0].postDataJSON()).toEqual({
    name: "Trzy ujęcia",
    investor: "",
    developer: "",
    imageFileIds: [fileIdAt(4), fileIdAt(2), fileIdAt(3)],
    r360FileId: null,
  });
  await expect(
    page.getByRole("heading", { name: "Nowa realizacja" }),
  ).toHaveCount(0);
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

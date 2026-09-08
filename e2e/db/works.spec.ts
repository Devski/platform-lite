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

async function pngBytes(): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 200, g: 120, b: 10 },
    },
  })
    .png()
    .toBuffer();
}

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

  await page.getByTestId("work-photo-0").setInputFiles({
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

  await page.getByTestId("work-photo-0").setInputFiles({
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

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
} from "./account";

// The upload button's WIRING (#12/#14), which nothing covered before.
//
// Three layers sit under "the photo upload works", and they are tested in
// three different places:
//
//   1. our code talks to OVH correctly — src/lib/storage-s3.test.ts, against
//      the real bucket. Skipped wherever S3_* is unset, which today means
//      every CI run.
//   2. the pipeline behind the routes — src/lib/avatar.test.ts, 25 tests
//      against a storage double. Runs everywhere.
//   3. what the BROWSER does when someone picks a file — here. Nothing ran in
//      CI for this: the only place a real click reached the upload was the
//      journey's photo step, which skips itself when there is no bucket.
//
// So this file stubs every response and asserts the browser's half of the
// contract: which calls it makes, with what, in what order, and — the part
// that matters most — which calls it does NOT make when a step fails.
//
// The upload target is deliberately same-origin. A real presigned URL is on
// the storage host and the PUT is cross-origin, but proving that our stub
// answers a preflight would prove nothing about the bucket's actual CORS
// configuration; that belongs to layer 1. Here the URL is just a string the
// server hands back and the browser must use verbatim.

if (process.env.CI && !process.env.DATABASE_URL_TEST?.trim()) {
  throw new Error(
    "DATABASE_URL_TEST is unset, so the chromium-db project would skip itself. In CI that is a broken workflow: check the step env in .github/workflows/ci.yml.",
  );
}
test.skip(
  !process.env.DATABASE_URL_TEST?.trim(),
  "no DATABASE_URL_TEST: the upload screen is behind a real session",
);

test.use({ locale: "pl-PL" });
// Registration runs a deliberately slow password hash, once, in beforeAll.
test.setTimeout(180_000);

const UPLOAD_URL = "/__stub-storage/staged-object";
const STAGING_KEY = "staging/someone/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FILE_ID = "11111111-1111-4111-8111-111111111111";

const json = (status: number, body: unknown) => (route: Route) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

// A real PNG, small enough to be cheap and real enough that the client's own
// type and size guards let it through.
async function pngBytes(): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 10, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

// ONE account, ONE session, shared by every test here — and serial, so they
// take turns on it.
//
// The first attempt gave each test its own account and they ran in parallel.
// Three passed and one failed, and which one moved between runs: four logins
// in the same second trip Better Auth's default cap on /sign-in/email. That
// limit is deliberate product behaviour (A2), so a test that trips it is
// failing for a reason it is not about. Registering once is also four times
// less scrypt, which is three seconds a go on purpose.
test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ locale: "pl-PL" });
  const identity = newIdentity();
  await registerAndVerify(page, identity);
  await logIn(page, identity);
  await completeOnboarding(page, identity);
});

test.afterAll(async () => {
  await page.close();
});

test.beforeEach(async () => {
  // A fresh render each time: the shared page still shows whatever the last
  // test left on it, including its success message.
  await page.goto("/settings/profile");
  await expect(
    page.getByRole("heading", { name: "Zdjęcie profilowe" }),
  ).toBeVisible();
});

test.afterEach(async () => {
  // Route handlers live on the page, not the test, so they would leak into
  // the next one and answer calls it meant to observe.
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("the button presigns, PUTs the bytes where it was told, then confirms", async () => {
  const file = await pngBytes();

  const presignRequests: Request[] = [];
  const uploads: Request[] = [];
  const confirmRequests: Request[] = [];
  const assignRequests: Request[] = [];

  await page.route("**/api/avatar/presign", (route) => {
    presignRequests.push(route.request());
    return json(200, { stagingKey: STAGING_KEY, uploadUrl: UPLOAD_URL })(route);
  });
  await page.route(`**${UPLOAD_URL}`, (route) => {
    uploads.push(route.request());
    return route.fulfill({ status: 200, body: "" });
  });
  await page.route("**/api/avatar/confirm", (route) => {
    confirmRequests.push(route.request());
    return json(200, { original: { fileId: FILE_ID } })(route);
  });
  await page.route("**/api/profile/avatar", (route) => {
    assignRequests.push(route.request());
    return json(200, {})(route);
  });

  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: file });

  await expect(page.getByText("Zdjęcie ustawione.")).toBeVisible();

  // The size and type come from the FILE, not from anything the page guessed:
  // the server signs those two values into the upload, so a mismatch here is
  // an upload the bucket would refuse (G4).
  expect(presignRequests).toHaveLength(1);
  expect(presignRequests[0].postDataJSON()).toEqual({
    sizeBytes: file.length,
    contentType: "image/png",
  });

  // The bytes go to the address the server returned, byte-for-byte, with the
  // two headers that ride the signature.
  expect(uploads).toHaveLength(1);
  expect(uploads[0].method()).toBe("PUT");
  expect(uploads[0].headers()["content-type"]).toBe("image/png");
  expect(uploads[0].headers()["cache-control"]).toBeTruthy();
  // postDataBuffer, not postData: the body is a PNG, and reading raw bytes
  // back as a string mangles the count.
  expect(uploads[0].postDataBuffer()?.length).toBe(file.length);

  // Confirm names the slot presign minted — not a key the page invented.
  expect(confirmRequests).toHaveLength(1);
  expect(confirmRequests[0].postDataJSON()).toEqual({
    stagingKey: STAGING_KEY,
  });

  // And the profile is pointed at the file confirm reported back.
  expect(assignRequests).toHaveLength(1);
  expect(assignRequests[0].postDataJSON()).toEqual({ fileId: FILE_ID });
});

test("a failed upload is not confirmed", async () => {
  let confirmed = false;
  await page.route(
    "**/api/avatar/presign",
    json(200, { stagingKey: STAGING_KEY, uploadUrl: UPLOAD_URL }),
  );
  await page.route(`**${UPLOAD_URL}`, (route) =>
    route.fulfill({ status: 500, body: "" }),
  );
  await page.route("**/api/avatar/confirm", (route) => {
    confirmed = true;
    return json(200, { original: { fileId: FILE_ID } })(route);
  });

  await page.locator('input[type="file"]').setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: await pngBytes(),
  });

  await expect(
    page.getByText("Wysyłka pliku nie powiodła się. Spróbuj ponownie."),
  ).toBeVisible();
  // The point of the test: confirm is what records the file and charges the
  // quota for it. Calling it after the bytes failed to land would record a
  // photo that does not exist.
  expect(confirmed).toBe(false);
});

test("a refused presign stops before anything is uploaded", async () => {
  let uploaded = false;
  await page.route("**/api/avatar/presign", json(429, {}));
  await page.route(`**${UPLOAD_URL}`, (route) => {
    uploaded = true;
    return route.fulfill({ status: 200, body: "" });
  });

  await page.locator('input[type="file"]').setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: await pngBytes(),
  });

  await expect(
    page.getByText("Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie."),
  ).toBeVisible();
  expect(uploaded).toBe(false);
});

test("a file the browser rejects never reaches the server", async () => {
  let presigned = false;
  await page.route("**/api/avatar/presign", (route) => {
    presigned = true;
    return json(200, { stagingKey: STAGING_KEY, uploadUrl: UPLOAD_URL })(route);
  });

  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });

  await expect(
    page.getByText(
      "Ten format nie jest obsługiwany — wybierz JPEG, PNG lub WebP.",
    ),
  ).toBeVisible();
  // Refusing early is not decoration: it is what keeps the presign rate limit
  // for uploads that could actually succeed.
  expect(presigned).toBe(false);
});

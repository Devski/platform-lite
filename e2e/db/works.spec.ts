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
import { buildZip } from "@/lib/r360/test-zip";
import { expectNoAxeViolations } from "../axe";
import { seedArchive, seedWorks } from "./seed-works";

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
// #102: the frame set the batch presign hands out, and where its PUTs go.
const SET_ID = "5".repeat(32);
const FRAME_URL = "/__stub-storage/frames";
const frameUrls = (width: number, count: number) =>
  Array.from({ length: count }, (_, i) => `${FRAME_URL}/${width}/${i + 1}`);

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

// #102: an orbit archive of a few frames, as the owner's software would
// export it — real PNGs, numbered, in one folder — read by the browser.
async function orbitZip(
  frameCount: number,
  folder = "orbit/",
  numbers?: number[],
) {
  const entries = [];
  for (const i of numbers ??
    Array.from({ length: frameCount }, (_, k) => k + 1)) {
    entries.push({
      name: `${folder}render_${String(i).padStart(4, "0")}.png`,
      data: new Uint8Array(await pngBytes(30 + i * 10)),
      method: 8,
    });
  }
  return Buffer.from(buildZip(entries));
}

// The ids the confirm stub hands out, one per upload, in order.
const fileIdAt = (n: number) =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;

let page: Page;
let identity: Identity;

test.beforeAll(async ({ browser }) => {
  // A page of its own context: axe (#103) refuses one from browser.newPage.
  page = await (await browser.newContext({ locale: "pl-PL" })).newPage();
  identity = newIdentity();
  await registerAndVerify(page, identity);
  await logIn(page, identity);
  await completeOnboarding(page, identity);
});

test.afterAll(async () => {
  await page.context().close();
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

  // The R360 archive: read in the browser first (#101) — what is not an
  // archive, or holds one frame, is refused before a byte leaves, with the
  // reason and no presign.
  const archivePresigns: Request[] = [];
  const archiveConfirms: Request[] = [];
  const setPresigns: Request[] = [];
  const framePuts: Request[] = [];
  await page.route("**/api/uploads/presign-archive", (route) => {
    archivePresigns.push(route.request());
    return json(200, { stagingKey: STAGING_KEY, uploadUrl: UPLOAD_URL })(route);
  });
  await page.route("**/api/uploads/confirm-archive", (route) => {
    archiveConfirms.push(route.request());
    return json(200, { fileId: ARCHIVE_ID, sizeBytes: 3 })(route);
  });
  await page.route("**/api/uploads/presign-r360-set", (route) => {
    setPresigns.push(route.request());
    const { frameCount } = route.request().postDataJSON() as {
      frameCount: number;
    };
    return json(200, {
      setId: SET_ID,
      stagingPrefix: `staging/someone/${SET_ID}/`,
      urls: {
        1600: frameUrls(1600, frameCount),
        800: frameUrls(800, frameCount),
      },
    })(route);
  });
  await page.route(`**${FRAME_URL}/**`, (route) => {
    framePuts.push(route.request());
    return route.fulfill({ status: 200, body: "" });
  });
  await page.getByTestId("work-r360").setInputFiles({
    name: "orbit.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("PK\u0003"),
  });
  await expect(page.getByText("To nie jest archiwum zip.")).toBeVisible();
  await page.getByTestId("work-r360").setInputFiles({
    name: "orbit.zip",
    mimeType: "application/zip",
    buffer: await orbitZip(1),
  });
  await expect(
    page.getByText("Jedna klatka to nie orbita: potrzeba co najmniej 2."),
  ).toBeVisible();
  expect(archivePresigns).toHaveLength(0);
  expect(setPresigns).toHaveLength(0);

  // A real orbit of three frames: the archive goes through its own presign
  // and confirm, never a read by the server, while this browser decodes the
  // frames, encodes them as WebP at two widths and PUTs the six straight to
  // the set's URLs (#102). The form then names the file, the set and the
  // default parameters on the work.
  const zip = await orbitZip(3);
  await page.getByTestId("work-r360").setInputFiles({
    name: "orbit.zip",
    mimeType: "application/zip",
    buffer: zip,
  });
  await expect(page.getByText("Wgrany", { exact: true })).toBeVisible();
  await expect(page.getByTestId("work-r360-frames")).toHaveText(
    "· Klatki gotowe: 3",
  );
  // #103: the preview from the frames themselves, "3 frames", a drag by
  // half the width at k = 2 turns one frame, "use this frame" sets the
  // start frame, and the form with the preview open passes axe.
  await expect(page.getByTestId("work-r360-frame-count")).toHaveText(
    "Klatki: 3",
  );
  const viewer = page.getByTestId("orbit-viewer");
  await expect(viewer).toHaveAttribute("data-frame", "1");
  // #117: the frames made here are painted onto a canvas, decoded once —
  // there is no address for the preview to hold and nothing to revoke.
  await expect(viewer.getByTestId("orbit-canvas")).toBeVisible();
  await expect(viewer.locator("img")).toHaveCount(0);
  // And the ring fills as an arc along itself, not as a comb of ticks:
  // three frames in a row are one path with two lines in it.
  await expect(page.getByTestId("orbit-ring-loaded")).toHaveAttribute(
    "d",
    /^M[^M]*L[^M]*L[^M]*$/,
  );
  // The mouse moves in viewport coordinates: the preview has to be in view.
  await viewer.scrollIntoViewIfNeeded();
  const box = await viewer.boundingBox();
  if (!box) throw new Error("no preview box");
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, {
    steps: 4,
  });
  await page.mouse.up();
  await expect(viewer).toHaveAttribute("data-frame", "2");
  await page.getByRole("button", { name: "Użyj tej klatki" }).click();
  await expect(page.getByTestId("work-r360-start-frame")).toHaveText("2");
  await expectNoAxeViolations(page, test.info(), "work-form-r360-preview");
  expect(archivePresigns[0].postDataJSON()).toEqual({
    sizeBytes: zip.length,
    contentType: "application/zip",
  });
  expect(archiveConfirms[0].postDataJSON()).toEqual({
    stagingKey: STAGING_KEY,
  });
  expect(setPresigns).toHaveLength(1);
  expect(setPresigns[0].postDataJSON()).toEqual({ frameCount: 3 });
  expect(framePuts).toHaveLength(6);
  expect(framePuts.map((put) => new URL(put.url()).pathname).sort()).toEqual(
    [...frameUrls(1600, 3), ...frameUrls(800, 3)].sort(),
  );
  for (const put of framePuts) {
    expect(put.method()).toBe("PUT");
    expect(put.headers()["content-type"]).toBe("image/webp");
    expect(put.headers()["cache-control"]).toContain("immutable");
    // Encoded here, not copied: a WebP by its header, not the PNG that
    // went in.
    const body = put.postDataBuffer();
    expect(body?.subarray(0, 4).toString()).toBe("RIFF");
    expect(body?.subarray(8, 12).toString()).toBe("WEBP");
  }

  await page.getByLabel("Inwestor").fill("Archicom S.A.");
  await page.getByRole("button", { name: "Zapisz realizację" }).click();
  await expect.poll(() => created.length).toBe(1);
  expect(created[0].postDataJSON()).toEqual({
    name: "Osiedle Nowe Żerniki, etap II",
    investor: "Archicom S.A.",
    developer: "",
    imageFileIds: [FILE_ID],
    r360FileId: ARCHIVE_ID,
    r360SetId: SET_ID,
    r360Params: {
      frameCount: 3,
      direction: 1,
      framesPerWidth: 2,
      startFrame: 2,
      flattening: 1,
    },
  });
  // Saved: the form folds away.
  await expect(
    page.getByRole("heading", { name: "Nowa realizacja" }),
  ).toHaveCount(0);
});

test("several at once (#79, #93): a pick that does not fit is refused, replace keeps the tile's place", async () => {
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

  // Three files when two fit: nothing goes up, the owner is told (#93).
  await picker.setInputFiles([
    await pngFile("b.png", 2),
    await pngFile("c.png", 3),
    await pngFile("d.png", 4),
  ]);
  await expect(
    page.getByText("Wybrano 3 zdjęcia, a zmieszczą się 2. Wybierz najwyżej 2."),
  ).toBeVisible();
  await expect(removeButtons).toHaveCount(1);
  expect(uploads).toBe(1);

  // Two files when two fit: both go up in parallel, and the "+" tile is
  // gone once the work is full.
  await picker.setInputFiles([
    await pngFile("b.png", 2),
    await pngFile("c.png", 3),
  ]);
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
  // Found by its name, so the wiring of the label is on the record.
  await page
    .getByLabel("Wymień zdjęcie")
    .first()
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
    r360SetId: null,
    r360Params: null,
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
  // #102: the frames go their own way meanwhile; here they are done long
  // before the archive's PUT is released.
  await page.route(
    "**/api/uploads/presign-r360-set",
    json(200, {
      setId: SET_ID,
      stagingPrefix: `staging/someone/${SET_ID}/`,
      urls: { 1600: frameUrls(1600, 2), 800: frameUrls(800, 2) },
    }),
  );
  await page.route(`**${FRAME_URL}/**`, (route) =>
    route.fulfill({ status: 200, body: "" }),
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
    buffer: await orbitZip(2),
  });

  // The bytes on their way: the shared bar (#80), with a cancel.
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Przerwij wysyłanie" }),
  ).toBeVisible();

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
    r360SetId: SET_ID,
    r360Params: {
      frameCount: 2,
      direction: 1,
      framesPerWidth: 1,
      startFrame: 1,
      flattening: 1,
    },
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

test("a photo's second channel (#99): uploaded through the same chain, posted by position, removable on its own", async () => {
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
    return json(200, { original: { fileId: fileIdAt(n) } })(route);
  });
  await page.route("**/api/uploads/discard", (route) => {
    discarded.push(route.request());
    return json(200, { ok: true })(route);
  });
  await page.route("**/api/works", (route) => {
    created.push(route.request());
    return json(200, { id: "33333333-3333-4333-8333-333333333333" })(route);
  });

  await page.getByLabel("Nazwa", { exact: true }).fill("Przed i po");
  await page
    .getByTestId("work-photos")
    .setInputFiles([await pngFile("a.png", 1), await pngFile("b.png", 2)]);
  await expect(page.getByRole("button", { name: "Usuń zdjęcie" })).toHaveCount(
    2,
  );

  // The channel on the first tile: its own upload, a badge once landed.
  await page
    .getByTestId("work-photo-channel-0")
    .setInputFiles(await pngFile("c.png", 3));
  await expect(page.getByText("2 kanały")).toBeVisible();
  expect(uploads).toBe(3);
  await expect(
    page.getByRole("button", { name: "Usuń drugi kanał" }),
  ).toHaveCount(1);

  // Replacing the photo keeps the tile's channel: the channel is the
  // tile's, not the picture's.
  await page
    .getByLabel("Wymień zdjęcie")
    .first()
    .setInputFiles(await pngFile("f.png", 4));
  await expect.poll(() => uploads).toBe(4);
  await expect.poll(() => discarded.length).toBe(1);
  expect(discarded[0].postDataJSON()).toEqual({ fileId: fileIdAt(1) });
  await expect(page.getByText("2 kanały")).toBeVisible();

  // Saved by position: the channel rides with the first photo.
  await page.getByRole("button", { name: "Zapisz realizację" }).click();
  await expect.poll(() => created.length).toBe(1);
  expect(created[0].postDataJSON()).toEqual({
    name: "Przed i po",
    investor: "",
    developer: "",
    imageFileIds: [fileIdAt(4), fileIdAt(2)],
    secondaryFileIds: [fileIdAt(3), null],
    r360FileId: null,
    r360SetId: null,
    r360Params: null,
  });
  await expect(
    page.getByRole("heading", { name: "Nowa realizacja" }),
  ).toHaveCount(0);

  // A second form: the channel removed on its own is discarded, and the
  // work posts without it.
  await page.getByRole("button", { name: "Dodaj realizację" }).click();
  await page.getByLabel("Nazwa", { exact: true }).fill("Bez kanału");
  await page
    .getByTestId("work-photos")
    .setInputFiles(await pngFile("d.png", 5));
  await expect(page.getByRole("button", { name: "Usuń zdjęcie" })).toHaveCount(
    1,
  );
  await page
    .getByTestId("work-photo-channel-0")
    .setInputFiles(await pngFile("e.png", 6));
  await expect(page.getByText("2 kanały")).toBeVisible();
  await page.getByRole("button", { name: "Usuń drugi kanał" }).click();
  await expect(page.getByText("2 kanały")).toHaveCount(0);
  await expect.poll(() => discarded.length).toBe(2);
  expect(discarded[1].postDataJSON()).toEqual({ fileId: fileIdAt(6) });
  await page.getByRole("button", { name: "Zapisz realizację" }).click();
  await expect.poll(() => created.length).toBe(2);
  expect(created[1].postDataJSON()).toEqual({
    name: "Bez kanału",
    investor: "",
    developer: "",
    imageFileIds: [fileIdAt(5)],
    r360FileId: null,
    r360SetId: null,
    r360Params: null,
  });
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

// After the seeded pair above: this one seeds a work of its own and leaves it.
test("an archive with a gap is refused on the page and sends nothing; a saved set shows its parameters again (#103)", async () => {
  const presigns: Request[] = [];
  await page.route("**/api/uploads/presign-archive", (route) => {
    presigns.push(route.request());
    return json(200, { stagingKey: STAGING_KEY, uploadUrl: UPLOAD_URL })(route);
  });
  await page.route("**/api/uploads/presign-r360-set", (route) => {
    presigns.push(route.request());
    return json(400, { error: "invalid_request" })(route);
  });
  await page.getByTestId("work-r360").setInputFiles({
    name: "orbit.zip",
    mimeType: "application/zip",
    buffer: await orbitZip(3, "orbit/", [1, 2, 4]),
  });
  await expect(
    page.getByText(
      "Numery klatek nie tworzą ciągu: orbit/render_0002.png, orbit/render_0004.png.",
    ),
  ).toBeVisible();
  await page.waitForTimeout(200);
  expect(presigns).toHaveLength(0);
  await expect(page.getByTestId("work-r360-preview")).toHaveCount(0);

  // A good archive whose set the server refuses (the quota, say): the
  // archive stays, without frames and without a preview of frames it does
  // not have, and the reason is told (#103 review).
  await page.route("**/api/uploads/confirm-archive", (route) =>
    json(200, { fileId: ARCHIVE_ID, sizeBytes: 3 })(route),
  );
  await page.route("**/api/uploads/presign-r360-set", (route) =>
    json(400, { error: "quota_exceeded" })(route),
  );
  await page.getByTestId("work-r360").setInputFiles({
    name: "orbit.zip",
    mimeType: "application/zip",
    buffer: await orbitZip(2),
  });
  await expect(page.getByText("Wgrany", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Brak miejsca: klatki przekroczyłyby Twój limit 10 GB."),
  ).toBeVisible();
  await expect(page.getByTestId("work-r360-preview")).toHaveCount(0);
  await expect(page.getByTestId("work-r360-frames")).toHaveCount(0);
  await page
    .locator("form")
    .getByRole("button", { name: "Usuń", exact: true })
    .click();

  // A work saved with a set: its parameters come back in edit mode, with
  // no photo to require.
  await page.getByRole("button", { name: "Anuluj" }).click();
  // Out of edit mode before the reload: the leave guard (#83) would hold
  // the page otherwise.
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edytuj profil" }),
  ).toBeVisible();
  const [seeded] = await seedWorks(identity.handle, [
    { name: "Orbita zapisana", r360: { frameCount: 4, startFrame: 3 } },
  ]);
  await page.reload();
  await page.getByRole("button", { name: "Edytuj profil" }).click();
  const card = page.getByRole("article").filter({ hasText: seeded.name });
  // #104: the set is the card's first picture — the start frame as the poster.
  await expect(card.getByTestId("orbit-viewer")).toBeVisible();
  await expect(card.getByTestId("orbit-viewer").locator("img")).toHaveAttribute(
    "src",
    // CI has no bucket: the base is empty there and the address is the key
    // alone. The width and the ordinal are what the poster proves.
    /(^|\/)800\/003\.webp$/,
  );
  await card.getByRole("button", { name: "Edytuj" }).click();
  await expect(page.getByTestId("work-r360-frame-count")).toHaveText(
    "Klatki: 4",
  );
  await expect(page.getByTestId("work-r360-start-frame")).toHaveText("3");
  await expect(page.getByTestId("orbit-viewer")).toHaveAttribute(
    "data-frame",
    "3",
  );
  await expect(page.getByTestId("work-r360-frames-per-width")).toHaveValue("2");
  await page.getByRole("button", { name: "Anuluj" }).click();
});
// #105: an archive that reached the bucket without its frames is offered
// on the next form and read again by Range through a signed address —
// stubbed here with a real archive served in pieces — and the work saves
// with the set it produced.
test("an archive that landed without frames is offered, its frames derived again by Range, and the work saves with the set (#105)", async () => {
  const zip = await orbitZip(3);
  const { fileId } = await seedArchive(identity.handle, zip.length);
  const ARCHIVE_URL = "/__stub-storage/landed-archive.zip";
  const ranges: string[] = [];
  const created: Request[] = [];
  await page.route("**/api/uploads/resume-archive", (route) =>
    json(200, { downloadUrl: ARCHIVE_URL, sizeBytes: zip.length })(route),
  );
  // The bucket, as a Range request sees it: 206 with Content-Range for a
  // range, the whole body without one.
  await page.route(`**${ARCHIVE_URL}`, (route) => {
    const range = route.request().headers()["range"];
    const match = /^bytes=(\d+)-(\d+)$/.exec(range ?? "");
    if (!match) return route.fulfill({ status: 200, body: zip });
    ranges.push(range);
    const start = Number(match[1]);
    const end = Math.min(Number(match[2]), zip.length - 1);
    return route.fulfill({
      status: 206,
      headers: {
        "content-range": `bytes ${start}-${end}/${zip.length}`,
        "accept-ranges": "bytes",
        "content-type": "application/zip",
      },
      body: zip.subarray(start, end + 1),
    });
  });
  await page.route("**/api/uploads/presign-r360-set", (route) =>
    json(200, {
      setId: SET_ID,
      stagingPrefix: `staging/someone/${SET_ID}/`,
      urls: { 1600: frameUrls(1600, 3), 800: frameUrls(800, 3) },
    })(route),
  );
  await page.route(`**${FRAME_URL}/**`, (route) =>
    route.fulfill({ status: 200, body: "" }),
  );
  await page.route("**/api/uploads/confirm", (route) =>
    json(200, { original: { fileId: FILE_ID } })(route),
  );
  await page.route("**/api/works", (route) => {
    created.push(route.request());
    return json(200, { id: "33333333-3333-4333-8333-333333333333" })(route);
  });

  // A fresh form asks the server what landed: the seeded archive is offered.
  await page.getByRole("button", { name: "Anuluj" }).click();
  await page.getByRole("button", { name: "Dodaj realizację" }).click();
  const offer = page.getByTestId("work-r360-offer");
  await expect(offer).toBeVisible();
  await expect(offer).toContainText("dotarło na serwer bez klatek");
  await offer.getByRole("button", { name: "Dokończ" }).click();
  await expect(page.getByText("Wgrany", { exact: true })).toBeVisible();
  await expect(page.getByTestId("work-r360-frames")).toHaveText(
    "· Klatki gotowe: 3",
  );
  // Read in pieces, never whole: the tail, the directory, each frame.
  expect(ranges.length).toBeGreaterThanOrEqual(4);
  expect(ranges[0]).toBe("bytes=0-0");

  await page.getByLabel("Nazwa", { exact: true }).fill("Dokończona orbita");
  await page.getByRole("button", { name: "Zapisz realizację" }).click();
  await expect.poll(() => created.length).toBe(1);
  expect(created[0].postDataJSON()).toEqual({
    name: "Dokończona orbita",
    investor: "",
    developer: "",
    imageFileIds: [],
    r360FileId: fileId,
    r360SetId: SET_ID,
    r360Params: {
      frameCount: 3,
      direction: 1,
      framesPerWidth: 2,
      startFrame: 1,
      flattening: 1,
    },
  });
});

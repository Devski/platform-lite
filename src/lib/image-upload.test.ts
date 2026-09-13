import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { files } from "@/db/schema";
import { insertTestAccount } from "@/db/test-account";
import { createTestDb, type TestDb } from "@/db/test-db";
import {
  confirmImageUpload,
  IMAGE_PROFILES,
  presignImageUpload,
} from "./image-upload";
import { createMemoryStorage, ownerKey } from "./storage";

// #72: the purpose-parametrised half of the pipeline. avatar.test.ts keeps
// proving the staging contract, the decode-verify and the quota through
// the avatar's names; this file proves what a PURPOSE changes — the kinds,
// the variant geometry, the owner in every key.

const PREFIX = "devski/";

let testDb: TestDb;
let userId: string;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  userId = await insertTestAccount(testDb.db, { email: "images@example.com" });
});

function deps() {
  const memory = createMemoryStorage();
  return {
    objects: memory.objects,
    common: { storage: memory.storage, db: testDb.db, prefix: PREFIX, userId },
  };
}

async function image(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 30, g: 60, b: 90 } },
  })
    .png()
    .toBuffer();
}

async function upload(
  d: ReturnType<typeof deps>,
  body: Buffer,
  purpose: "avatar" | "cover" | "work",
) {
  const { stagingKey } = await presignImageUpload(d.common, {
    sizeBytes: body.length,
    contentType: "image/png",
  });
  await d.common.storage.putObject(stagingKey, body, "image/png");
  return confirmImageUpload(d.common, { stagingKey, purpose });
}

describe("ownerKey (SPEC §9)", () => {
  it("puts the content hash under the owner, prefix first", () => {
    expect(ownerKey("u-1", "abc", "webp", "devski/")).toBe(
      "devski/u/u-1/abc.webp",
    );
    expect(ownerKey("u-1", "abc", "jpg")).toBe("u/u-1/abc.jpg");
  });
});

describe("confirmImageUpload by purpose", () => {
  it("a cover keeps its aspect ratio at 1600 and 480 wide, under the owner's keys", async () => {
    const d = deps();
    const result = await upload(d, await image(2400, 800), "cover");
    expect(result.original.key).toBe(
      ownerKey(userId, result.original.sha256, "png", PREFIX),
    );
    expect(result.variants.map((v) => v.kind)).toEqual([
      "cover-1600",
      "cover-480",
    ]);
    for (const [variant, width, height] of [
      [result.variants[0], 1600, 533],
      [result.variants[1], 480, 160],
    ] as const) {
      expect(variant.key).toBe(
        ownerKey(
          userId,
          `${result.original.sha256}-${width}q80`,
          "webp",
          PREFIX,
        ),
      );
      const meta = await sharp(d.objects.get(variant.key)!.body).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual([
        "webp",
        width,
        height,
      ]);
      expect(d.objects.get(variant.key)!.publicRead).toBe(true);
    }
    // The original stays private and is recorded under its own kind.
    expect(d.objects.get(result.original.key)!.publicRead).toBe(false);
    const rows = await testDb.db.select().from(files);
    expect(rows.map((row) => row.kind).sort()).toEqual([
      "cover-1600",
      "cover-480",
      "cover-original",
    ]);
  });

  it("never enlarges: a small work photo stays its size in both variants", async () => {
    const d = deps();
    const result = await upload(d, await image(300, 450), "work");
    for (const variant of result.variants) {
      const meta = await sharp(d.objects.get(variant.key)!.body).metadata();
      expect([meta.width, meta.height]).toEqual([300, 450]);
    }
    expect(result.variants.map((v) => v.kind)).toEqual([
      "work-1600",
      "work-480",
    ]);
  });

  it("an avatar is still the centre-cropped square set", async () => {
    const d = deps();
    const result = await upload(d, await image(900, 600), "avatar");
    expect(result.variants.map((v) => v.kind)).toEqual(
      IMAGE_PROFILES.avatar.variants.map((v) => v.kind),
    );
    const meta = await sharp(
      d.objects.get(result.variants[0].key)!.body,
    ).metadata();
    expect([meta.width, meta.height]).toEqual([512, 512]);
  });

  // #65: the variants used to be cut from the pipeline's own quality-80
  // re-encode of the original — a second loss under every published picture.
  // A JPEG with fine detail tells the two routes apart.
  it("an avatar is the uploaded pixels encoded once, as its table entry says", async () => {
    const d = deps();
    const photo = await sharp({
      create: {
        width: 900,
        height: 600,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
        noise: { type: "gaussian", mean: 128, sigma: 40 },
      },
    })
      .jpeg({ quality: 95 })
      .toBuffer();
    const result = await upload(d, photo, "avatar");
    const cut = (from: Buffer, index: number) => {
      const spec = IMAGE_PROFILES.avatar.variants[index];
      return sharp(from, { autoOrient: true })
        .resize(spec.size, spec.size, { fit: "cover", position: "centre" })
        .webp({ quality: spec.quality, smartSubsample: spec.smartSubsample })
        .toBuffer();
    };
    for (const index of [0, 1]) {
      const stored = d.objects.get(result.variants[index].key)!.body;
      expect(stored.equals(await cut(photo, index))).toBe(true);
      // Proof the comparison can fail: the same cut from the re-encode.
      const reencoded = d.objects.get(result.original.key)!.body;
      expect(stored.equals(await cut(reencoded, index))).toBe(false);
    }
    expect(result.variants.map((v) => v.key)).toEqual([
      ownerKey(userId, `${result.original.sha256}-512q95s`, "webp", PREFIX),
      ownerKey(userId, `${result.original.sha256}-128q95s`, "webp", PREFIX),
    ]);
  });

  // #65 cut the variants from the upload itself, which still carries its
  // EXIF — the scrubbed re-encode no longer stands between them. A cover shows
  // what a square avatar cannot: whether the pixels were turned upright.
  it("a variant cut from the upload is turned upright and carries none of its metadata", async () => {
    const d = deps();
    // 300x200 marked Orientation 6: displayed, it is 200x300.
    const sideways = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: 10, g: 200, b: 10 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6, density: 300 })
      .toBuffer();
    const result = await upload(d, sideways, "cover");
    for (const variant of result.variants) {
      const meta = await sharp(d.objects.get(variant.key)!.body).metadata();
      expect([meta.width, meta.height]).toEqual([200, 300]);
      expect([meta.orientation, meta.exif]).toEqual([undefined, undefined]);
    }
  });

  it("the same bytes as a cover and as a work photo share the 1600 object and keep two originals", async () => {
    const d = deps();
    const body = await image(2000, 1000);
    const cover = await upload(d, body, "cover");
    const work = await upload(d, body, "work");
    expect(cover.original.key).toBe(work.original.key);
    expect(cover.variants[0].key).toBe(work.variants[0].key);
    const rows = await testDb.db.select().from(files);
    expect(rows.filter((row) => row.parentFileId === null)).toHaveLength(2);
    // One object each for the original and the two widths, six rows.
    expect(d.objects.size).toBe(3);
    expect(rows).toHaveLength(6);
  });
});

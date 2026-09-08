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
        ownerKey(userId, `${result.original.sha256}-${width}`, "webp", PREFIX),
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

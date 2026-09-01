import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { files, users } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-db";
import {
  AVATAR_MAX_BYTES,
  AvatarUploadError,
  confirmAvatarUpload,
  presignAvatarUpload,
} from "./avatar";
import { QUOTA_BYTES } from "./quota";
import { createMemoryStorage } from "./storage";

// Unit + integration suite for the #12 avatar pipeline, on the G1 memory fake
// and the PGlite test database — no bucket, no network. The pipeline follows
// the staging contract recorded on the issue: presign a random user-bound
// staging key, verify server-side, publish under content-addressed keys.

const PREFIX = "devski/";
const USER_EMAIL = "avatars@example.com";

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
  const [user] = await testDb.db
    .insert(users)
    .values({ name: "avatars", email: USER_EMAIL })
    .returning({ id: users.id });
  userId = user.id;
});

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function makeImage(
  format: "png" | "jpeg" | "webp" | "gif",
  width = 900,
  height = 600,
): Promise<Buffer> {
  const base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 90, b: 200 },
    },
  });
  return base.toFormat(format).toBuffer();
}

function deps(storage = createMemoryStorage()) {
  return {
    storage: storage.storage,
    objects: storage.objects,
    common: {
      storage: storage.storage,
      db: testDb.db,
      prefix: PREFIX,
      userId,
    },
  };
}

/** Stage bytes exactly as a browser upload would land them. */
async function staged(
  d: ReturnType<typeof deps>,
  body: Buffer,
  contentType = "image/png",
): Promise<string> {
  const { stagingKey } = await presignAvatarUpload(d.common, {
    sizeBytes: body.length,
    contentType: contentType as "image/png",
  });
  await d.storage.putObject(stagingKey, body, contentType);
  return stagingKey;
}

describe("presignAvatarUpload (A4, G4)", () => {
  it("presigns a random staging key bound to the user, never a content key", async () => {
    const d = deps();
    const { stagingKey, uploadUrl } = await presignAvatarUpload(d.common, {
      sizeBytes: 1234,
      contentType: "image/jpeg",
    });
    expect(stagingKey).toMatch(
      new RegExp(`^${PREFIX}staging/${userId}/[0-9a-f]{32}$`),
    );
    expect(uploadUrl).toContain(stagingKey);
    // Two presigns never share a key.
    const second = await presignAvatarUpload(d.common, {
      sizeBytes: 1234,
      contentType: "image/jpeg",
    });
    expect(second.stagingKey).not.toBe(stagingKey);
  });

  it("refuses to presign past the quota (A9, checked before any URL is minted)", async () => {
    const d = deps();
    await testDb.db.insert(files).values({
      userId,
      sha256: "presign-quota-seed",
      sizeBytes: QUOTA_BYTES - 50,
      kind: "avatar-original",
    });
    await expect(
      presignAvatarUpload(d.common, { sizeBytes: 51, contentType: "image/png" }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
    // Right at the limit still passes.
    await expect(
      presignAvatarUpload(d.common, { sizeBytes: 50, contentType: "image/png" }),
    ).resolves.toBeTruthy();
  });

  it("rejects oversize declarations and foreign content types at the edge", async () => {
    const d = deps();
    await expect(
      presignAvatarUpload(d.common, {
        sizeBytes: AVATAR_MAX_BYTES + 1,
        contentType: "image/png",
      }),
    ).rejects.toThrow();
    await expect(
      presignAvatarUpload(d.common, {
        sizeBytes: 10,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately foreign type for the edge test
        contentType: "image/gif" as any,
      }),
    ).rejects.toThrow();
  });
});

describe("confirmAvatarUpload (A4, G2, G5)", () => {
  it("publishes the original and square WebP 512/128 under content keys and records 3 rows", async () => {
    const d = deps();
    const original = await makeImage("png");
    const stagingKey = await staged(d, original);

    const result = await confirmAvatarUpload(d.common, { stagingKey });

    // Content-addressed original named by its own bytes (G2).
    const originalHash = sha256(original);
    expect(result.original.key).toBe(`${PREFIX}a/${originalHash}.png`);
    expect(result.original.url).toBe(`memory://${PREFIX}a/${originalHash}.png`);

    // Variants: square WebP at 512 and 128, derivable from the original hash.
    expect(result.variants.map((v) => v.kind)).toEqual([
      "avatar-512",
      "avatar-128",
    ]);
    for (const variant of result.variants) {
      const px = variant.kind === "avatar-512" ? 512 : 128;
      expect(variant.key).toBe(`${PREFIX}a/${originalHash}-${px}.webp`);
      const stored = d.objects.get(variant.key);
      expect(stored?.contentType).toBe("image/webp");
      const meta = await sharp(stored!.body).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(px);
      expect(meta.height).toBe(px);
    }

    // The staging object is gone; exactly the three published objects remain.
    expect(d.objects.has(stagingKey)).toBe(false);
    expect(d.objects.size).toBe(3);

    // §9 files rows: original + both variants with real hashes and sizes.
    const rows = await testDb.db.select().from(files);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.kind).sort()).toEqual([
      "avatar-128",
      "avatar-512",
      "avatar-original",
    ]);
    const originalRow = rows.find((r) => r.kind === "avatar-original")!;
    expect(originalRow.userId).toBe(userId);
    expect(originalRow.sha256).toBe(originalHash);
    expect(originalRow.sizeBytes).toBe(original.length);
    expect(result.original.fileId).toBe(originalRow.id);
    for (const row of rows.filter((r) => r.kind !== "avatar-original")) {
      const stored = d.objects.get(
        `${PREFIX}a/${originalHash}-${row.kind === "avatar-512" ? 512 : 128}.webp`,
      )!;
      expect(row.sha256).toBe(sha256(stored.body));
      expect(row.sizeBytes).toBe(stored.body.length);
    }
  });

  it("keeps the extension of the DECODED format, not the claimed content type", async () => {
    const d = deps();
    const jpeg = await makeImage("jpeg");
    // Claimed as PNG; the decoder decides.
    const stagingKey = await staged(d, jpeg, "image/png");
    const result = await confirmAvatarUpload(d.common, { stagingKey });
    expect(result.original.key).toBe(`${PREFIX}a/${sha256(jpeg)}.jpg`);
  });

  it("refuses a staging key outside this user's namespace", async () => {
    const d = deps();
    await expect(
      confirmAvatarUpload(d.common, {
        stagingKey: `${PREFIX}staging/someone-else/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`,
      }),
    ).rejects.toMatchObject({ code: "invalid_key" });
    await expect(
      confirmAvatarUpload(d.common, {
        stagingKey: `${PREFIX}a/deadbeef.png`,
      }),
    ).rejects.toMatchObject({ code: "invalid_key" });
  });

  it("maps a missing upload to not_found (the client never uploaded)", async () => {
    const d = deps();
    const { stagingKey } = await presignAvatarUpload(d.common, {
      sizeBytes: 10,
      contentType: "image/png",
    });
    await expect(
      confirmAvatarUpload(d.common, { stagingKey }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects bytes that are not an image at all", async () => {
    const d = deps();
    const stagingKey = await staged(d, Buffer.from("definitely not an image"));
    await expect(
      confirmAvatarUpload(d.common, { stagingKey }),
    ).rejects.toMatchObject({ code: "not_an_image" });
    // Nothing published, nothing recorded.
    expect(await testDb.db.select().from(files)).toHaveLength(0);
  });

  it("rejects decodable but unsupported formats (A4 allowlist)", async () => {
    const d = deps();
    const gif = await makeImage("gif");
    const stagingKey = await staged(d, gif, "image/png");
    await expect(
      confirmAvatarUpload(d.common, { stagingKey }),
    ).rejects.toMatchObject({ code: "unsupported_format" });
  });

  it("rejects a staged object over the A4 cap (belt over the signed length)", async () => {
    const d = deps();
    // Planted directly, bypassing presign — the exact path the belt guards:
    // an object that reached the bucket outside our signed flow.
    const stagingKey = `${PREFIX}staging/${userId}/${"ab".repeat(16)}`;
    await d.storage.putObject(
      stagingKey,
      Buffer.alloc(AVATAR_MAX_BYTES + 1),
      "image/png",
    );
    await expect(
      confirmAvatarUpload(d.common, { stagingKey }),
    ).rejects.toMatchObject({ code: "too_large" });
  });

  it("still succeeds when the staging cleanup fails (best-effort delete)", async () => {
    const memory = createMemoryStorage();
    const d = deps({
      objects: memory.objects,
      storage: {
        ...memory.storage,
        deleteObject: async () => {
          throw new Error("transient S3 hiccup");
        },
      },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const original = await makeImage("png", 300, 300);
      const stagingKey = await staged(d, original);
      const result = await confirmAvatarUpload(d.common, { stagingKey });
      expect(result.variants).toHaveLength(2);
      expect(await testDb.db.select().from(files)).toHaveLength(3);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("exposes a typed error for the route layer", () => {
    const error = new AvatarUploadError("not_found");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("not_found");
  });

  it("bakes the EXIF orientation into the published pixels (portrait phones)", async () => {
    const d = deps();
    // A 300x200 landscape marked Orientation 6 (rotate 90 CW to display):
    // the honest output is 200x300 portrait everywhere.
    const rotated = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: 10, g: 200, b: 10 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const stagingKey = await staged(d, rotated, "image/jpeg");
    const result = await confirmAvatarUpload(d.common, { stagingKey });

    const published = d.objects.get(result.original.key)!.body;
    const meta = await sharp(published).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(300);
    expect(meta.orientation).toBeUndefined();
  });

  it("publishes a metadata-scrubbed re-encode, never the uploaded bytes", async () => {
    const d = deps();
    const withExif = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r: 5, g: 5, b: 120 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 3, density: 300 })
      .toBuffer();
    const stagingKey = await staged(d, withExif, "image/jpeg");
    const result = await confirmAvatarUpload(d.common, { stagingKey });

    const published = d.objects.get(result.original.key)!.body;
    expect(published.equals(withExif)).toBe(false);
    // G2: the content address is the hash of the PUBLISHED bytes.
    expect(result.original.sha256).toBe(sha256(published));
    expect((await sharp(published).metadata()).orientation).toBeUndefined();
  });

  it("maps a truncated pixel stream to not_an_image, publishing nothing", async () => {
    const d = deps();
    const whole = await makeImage("jpeg");
    // The header survives; the pixel data does not.
    const truncated = whole.subarray(0, Math.floor(whole.length / 2));
    const stagingKey = await staged(d, Buffer.from(truncated), "image/jpeg");
    await expect(
      confirmAvatarUpload(d.common, { stagingKey }),
    ).rejects.toMatchObject({ code: "not_an_image" });
    expect(await testDb.db.select().from(files)).toHaveLength(0);
    // Nothing published, and the unusable staging object was discarded too.
    expect(d.objects.size).toBe(0);
  });

  it("rejects images over the pixel ceiling before decoding them", async () => {
    const d = deps();
    // 9000x8000 = 72 MP > the 64 MP ceiling; flat PNG, tiny on disk.
    const huge = await makeImage("png", 9000, 8000);
    const stagingKey = await staged(d, huge);
    await expect(
      confirmAvatarUpload(d.common, { stagingKey }),
    ).rejects.toMatchObject({ code: "too_large" });
  });

  it("re-checks the quota at confirm against the REAL published bytes", async () => {
    const d = deps();
    const original = await makeImage("png", 300, 300);
    const stagingKey = await staged(d, original);
    // Another upload landed between presign and confirm and ate the room.
    await testDb.db.insert(files).values({
      userId,
      sha256: "confirm-quota-seed",
      sizeBytes: QUOTA_BYTES - 10,
      kind: "avatar-original",
    });
    await expect(
      confirmAvatarUpload(d.common, { stagingKey }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
    // Nothing was published or recorded beyond the seed row, and the doomed
    // staging object was discarded (a retry needs a fresh presign anyway).
    expect(d.objects.size).toBe(0);
    expect(await testDb.db.select().from(files)).toHaveLength(1);
  });

  it("a replay of already-recorded bytes passes even with zero quota room", async () => {
    const d = deps();
    const original = await makeImage("png", 400, 400);
    const stagingKey = await staged(d, original);
    const first = await confirmAvatarUpload(d.common, { stagingKey });
    const recorded = await testDb.db.select().from(files);
    const used = recorded.reduce((total, row) => total + row.sizeBytes, 0);
    // Fill the quota to exactly the limit.
    await testDb.db.insert(files).values({
      userId,
      sha256: "filler",
      sizeBytes: QUOTA_BYTES - used,
      kind: "avatar-original",
    });

    await d.storage.putObject(stagingKey, original, "image/png");
    const replay = await confirmAvatarUpload(d.common, { stagingKey });
    expect(replay.original.fileId).toBe(first.original.fileId);
    expect(await testDb.db.select().from(files)).toHaveLength(4);
  });

  it("replayed confirms re-record nothing (A9 quota integrity)", async () => {
    const d = deps();
    const original = await makeImage("png", 400, 400);
    const stagingKey = await staged(d, original);
    const first = await confirmAvatarUpload(d.common, { stagingKey });

    // The presigned URL outlives the first confirm; the client re-PUTs the
    // same bytes and confirms again.
    await d.storage.putObject(stagingKey, original, "image/png");
    const second = await confirmAvatarUpload(d.common, { stagingKey });

    expect(second.original.fileId).toBe(first.original.fileId);
    expect(await testDb.db.select().from(files)).toHaveLength(3);
  });
});

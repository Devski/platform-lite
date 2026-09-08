import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
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
import { files, pendingUploads } from "@/db/schema";
import { insertTestAccount } from "@/db/test-account";
import { createTestDb, type TestDb } from "@/db/test-db";
import {
  AVATAR_MAX_BYTES,
  AvatarUploadError,
  confirmAvatarUpload,
  presignAvatarUpload,
} from "./avatar";
import { QUOTA_BYTES, quotaUsageBytes } from "./quota";
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
  // Built the way registration builds an account (#40).
  userId = await insertTestAccount(testDb.db, { email: USER_EMAIL });
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
      ext: "png",
    });
    await expect(
      presignAvatarUpload(d.common, {
        sizeBytes: 51,
        contentType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
    // Right at the limit still passes.
    await expect(
      presignAvatarUpload(d.common, {
        sizeBytes: 50,
        contentType: "image/png",
      }),
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
    expect(result.original.key).toBe(
      `${PREFIX}u/${userId}/${originalHash}.png`,
    );
    expect(result.original.url).toBe(
      `memory://${PREFIX}u/${userId}/${originalHash}.png`,
    );

    // Variants: square WebP at 512 and 128, derivable from the original hash.
    expect(result.variants.map((v) => v.kind)).toEqual([
      "avatar-512",
      "avatar-128",
    ]);
    for (const variant of result.variants) {
      const px = variant.kind === "avatar-512" ? 512 : 128;
      expect(variant.key).toBe(
        `${PREFIX}u/${userId}/${originalHash}-${px}.webp`,
      );
      const stored = d.objects.get(variant.key);
      expect(stored?.contentType).toBe("image/webp");
      const meta = await sharp(stored!.body).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(px);
      expect(meta.height).toBe(px);
    }

    // Only the two variants carry the public ACL; the original and anything
    // staged stay private (G3 covers what the page renders, not the upload).
    for (const [key, stored] of d.objects) {
      expect({ key, publicRead: stored.publicRead }).toEqual({
        key,
        publicRead: /-(?:512|128)[.]webp$/.test(key),
      });
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
        `${PREFIX}u/${userId}/${originalHash}-${row.kind === "avatar-512" ? 512 : 128}.webp`,
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
    expect(result.original.key).toBe(
      `${PREFIX}u/${userId}/${sha256(jpeg)}.jpg`,
    );
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
      ext: "png",
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
      ext: "png",
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

const MB = 1024 * 1024;

describe("A9 accounting for staged uploads (#30)", () => {
  // The hole this closes: usage was SUM(files.size_bytes), and a staged upload
  // has no `files` row until it is confirmed. Presign is capped at 10/min at
  // 10 MB each — 100 MB a minute per account that nothing was counting.

  /** Fill the quota to within `roomBytes` with already-stored bytes. */
  async function fillQuotaLeaving(roomBytes: number): Promise<void> {
    await testDb.db.insert(files).values({
      userId,
      sha256: "a".repeat(64),
      sizeBytes: QUOTA_BYTES - roomBytes,
      kind: "avatar-original",
      ext: "png",
    });
  }

  it("refuses a presign that only fits if staged bytes are ignored", async () => {
    const d = deps();
    await fillQuotaLeaving(8 * MB);
    // Two staged uploads fill the remaining room exactly. Nothing is uploaded
    // and nothing is confirmed — before #30 both were invisible and the third
    // presign would have been minted just as happily as the first.
    await presignAvatarUpload(d.common, {
      sizeBytes: 4 * MB,
      contentType: "image/png",
    });
    await presignAvatarUpload(d.common, {
      sizeBytes: 4 * MB,
      contentType: "image/png",
    });
    expect(await quotaUsageBytes(testDb.db, userId)).toBe(QUOTA_BYTES);
    await expect(
      presignAvatarUpload(d.common, {
        sizeBytes: 1024,
        contentType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
  });

  it("stops counting an abandoned upload, then sweeps its object away", async () => {
    const d = deps();
    const stagingKey = await staged(d, Buffer.alloc(4 * MB, 7));
    expect(await quotaUsageBytes(testDb.db, userId)).toBe(4 * MB);

    // The browser walked away and the upload window closed. Both timestamps
    // move: a row whose window ended before it began is a state the CHECK
    // constraint rightly forbids, so simulate an old reservation, not an
    // impossible one.
    await testDb.db
      .update(pendingUploads)
      .set({
        createdAt: new Date(Date.now() - 600_000),
        expiresAt: new Date(Date.now() - 60_000),
      })
      .where(eq(pendingUploads.stagingKey, stagingKey));

    // Freed immediately: expiry is evaluated in the query, so a walked-away
    // browser never holds the quota hostage until someone sweeps.
    expect(await quotaUsageBytes(testDb.db, userId)).toBe(0);
    expect(d.objects.has(stagingKey)).toBe(true);

    // The sweep is lazy — this user's next presign pays for their own mess.
    await presignAvatarUpload(d.common, {
      sizeBytes: 1024,
      contentType: "image/png",
    });
    expect(d.objects.has(stagingKey)).toBe(false);
    expect(
      await testDb.db
        .select()
        .from(pendingUploads)
        .where(eq(pendingUploads.stagingKey, stagingKey)),
    ).toHaveLength(0);
  });

  it("charges a confirmed upload once, not twice", async () => {
    const d = deps();
    const png = await makeImage("png");
    const stagingKey = await staged(d, png);
    // Reserved on the declared size while the bytes sit in staging.
    expect(await quotaUsageBytes(testDb.db, userId)).toBe(png.length);

    await confirmAvatarUpload(d.common, { stagingKey });

    const rows = await testDb.db
      .select()
      .from(files)
      .where(eq(files.userId, userId));
    const storedBytes = rows.reduce((total, row) => total + row.sizeBytes, 0);
    // Exactly the published bytes: the reservation was settled, not stacked
    // on top of the rows it turned into.
    expect(await quotaUsageBytes(testDb.db, userId)).toBe(storedBytes);
    // Settled, NOT deleted: the presigned URL outlives the confirm, so the row
    // has to stay as the sweep's only handle on that key.
    expect(await testDb.db.select().from(pendingUploads)).toHaveLength(1);
  });

  it("releases the reservation when the upload is refused", async () => {
    const d = deps();
    const stagingKey = await staged(d, Buffer.from("definitely not an image"));
    await expect(
      confirmAvatarUpload(d.common, { stagingKey }),
    ).rejects.toMatchObject({ code: "not_an_image" });
    // Refused bytes are deleted, so charging for them would be indefensible.
    expect(await quotaUsageBytes(testDb.db, userId)).toBe(0);
    // But the row stays: see the re-upload regression below.
    expect(await testDb.db.select().from(pendingUploads)).toHaveLength(1);
  });

  // The regression the #30 review caught: settling by DELETE stopped the
  // charge but also destroyed the sweep's only record of the key, while the
  // presigned URL stayed live and reusable. A client could re-upload into a
  // key that neither the quota nor the sweep could ever see again — the very
  // hole #30 exists to close, reopened one step later in the same function.
  it.each([
    ["a refused confirm", false],
    ["a successful confirm", true],
  ])("sweeps a re-upload made after %s", async (_label, succeed) => {
    const d = deps();
    const body = succeed
      ? await makeImage("png")
      : Buffer.from("definitely not an image");
    const stagingKey = await staged(d, body);
    if (succeed) {
      await confirmAvatarUpload(d.common, { stagingKey });
    } else {
      await expect(
        confirmAvatarUpload(d.common, { stagingKey }),
      ).rejects.toThrow(AvatarUploadError);
    }
    expect(d.objects.has(stagingKey)).toBe(false);

    // The URL has not expired, so the client PUTs the same bytes again.
    await d.storage.putObject(stagingKey, body, "image/png");
    expect(d.objects.has(stagingKey)).toBe(true);

    // The settled reservation is what makes this reachable — and the sweep
    // must catch a row settled moments ago, not only one that aged out.
    await presignAvatarUpload(d.common, {
      sizeBytes: 1024,
      contentType: "image/png",
    });
    expect(d.objects.has(stagingKey)).toBe(false);
  });

  it("does not let two parallel presigns overshoot the quota", async () => {
    const d = deps();
    await fillQuotaLeaving(4 * MB);
    // Room for exactly one. Read-then-insert as two statements let both pass.
    const results = await Promise.allSettled([
      presignAvatarUpload(d.common, {
        sizeBytes: 4 * MB,
        contentType: "image/png",
      }),
      presignAvatarUpload(d.common, {
        sizeBytes: 4 * MB,
        contentType: "image/png",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await quotaUsageBytes(testDb.db, userId)).toBeLessThanOrEqual(
      QUOTA_BYTES,
    );
  });

  it("keeps the reservation when the client has not uploaded yet", async () => {
    const d = deps();
    const { stagingKey, uploadUrl } = await presignAvatarUpload(d.common, {
      sizeBytes: 4 * MB,
      contentType: "image/png",
    });
    expect(uploadUrl).toContain(stagingKey);
    // The presigned URL is still live, so the bytes can still arrive: an early
    // confirm must not hand the room back and let the caller reserve it twice.
    await expect(
      confirmAvatarUpload(d.common, { stagingKey }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await quotaUsageBytes(testDb.db, userId)).toBe(4 * MB);
  });
});

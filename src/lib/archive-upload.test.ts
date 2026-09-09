import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { files, pendingUploads } from "@/db/schema";
import { insertTestAccount } from "@/db/test-account";
import { createTestDb, type TestDb } from "@/db/test-db";
import {
  ARCHIVE_MAX_BYTES,
  archiveReservationSeconds,
  confirmArchiveUpload,
  presignArchiveUpload,
} from "./archive-upload";
import { abandonStagedUpload } from "./image-upload";
import { QUOTA_BYTES } from "./quota";
import { createMemoryStorage, ownerKey } from "./storage";

// #72 / A12: the R360 archive on PGlite + the memory fake. What matters:
// no 10 MB cap, the bytes charged from the presign, confirm never reading
// the object (head + copy), the identity from storage's checksum, and the
// same archive twice landing on one row.

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
  userId = await insertTestAccount(testDb.db, { email: "r360@example.com" });
});

function deps() {
  const memory = createMemoryStorage();
  return {
    objects: memory.objects,
    common: { storage: memory.storage, db: testDb.db, prefix: PREFIX, userId },
  };
}

/** Stored bytes that leave exactly `roomBytes` of quota: an archive is at
 *  most 5 GB, so since the quota is 10 GB it cannot fill the account alone. */
async function fillQuotaButFor(roomBytes: number) {
  await testDb.db.insert(files).values({
    userId,
    sha256: "hash-filler",
    sizeBytes: QUOTA_BYTES - roomBytes,
    kind: "avatar-original",
    ext: "png",
  });
}

async function stage(d: ReturnType<typeof deps>, body: Buffer) {
  const { stagingKey } = await presignArchiveUpload(d.common, {
    sizeBytes: body.length,
    contentType: "application/zip",
  });
  await d.common.storage.putObject(stagingKey, body, "application/zip");
  return stagingKey;
}

describe("presignArchiveUpload", () => {
  it("accepts sizes far beyond the image cap, refuses only S3's own ceiling and the wrong type", async () => {
    const d = deps();
    const big = 800 * 1024 * 1024;
    const { stagingKey } = await presignArchiveUpload(d.common, {
      sizeBytes: big,
      contentType: "application/zip",
    });
    expect(stagingKey).toMatch(
      new RegExp(`^${PREFIX}staging/${userId}/[0-9a-f]{32}$`),
    );
    // Reserved in full for a window that follows the size (#30): about
    // 35 minutes for 800 MB, not a flat four hours.
    const [reservation] = await testDb.db.select().from(pendingUploads);
    expect(reservation.sizeBytes).toBe(big);
    const window =
      (reservation.expiresAt.getTime() - reservation.createdAt.getTime()) /
      1000;
    expect(Math.round(window)).toBe(archiveReservationSeconds(big));
    expect(archiveReservationSeconds(5 * 1024 * 1024)).toBeLessThan(16 * 60);
    // 5 GiB at the half-megabyte floor: a little over three hours.
    expect(archiveReservationSeconds(ARCHIVE_MAX_BYTES)).toBeLessThan(
      3.5 * 60 * 60,
    );
    await expect(
      presignArchiveUpload(d.common, {
        sizeBytes: ARCHIVE_MAX_BYTES + 1,
        contentType: "application/zip",
      }),
    ).rejects.toThrow();
    await expect(
      presignArchiveUpload(d.common, {
        sizeBytes: 10,
        contentType: "image/png",
      }),
    ).rejects.toThrow();
  });

  it("an abandoned upload frees its reservation at once, so the retry fits (step 5 review)", async () => {
    const d = deps();
    const size = 2 * 1024 * 1024 * 1024;
    await fillQuotaButFor(size);
    const { stagingKey } = await presignArchiveUpload(d.common, {
      sizeBytes: size,
      contentType: "application/zip",
    });
    // Still reserved: the same size again does not fit.
    await expect(
      presignArchiveUpload(d.common, {
        sizeBytes: size,
        contentType: "application/zip",
      }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
    await abandonStagedUpload(d.common, { stagingKey });
    await expect(
      presignArchiveUpload(d.common, {
        sizeBytes: size,
        contentType: "application/zip",
      }),
    ).resolves.toBeTruthy();
    // The abandoned row was swept by that presign (expired rows are); the
    // retry's own reservation stands. Someone else's key, or a content key:
    // ignored, nothing settled.
    await abandonStagedUpload(d.common, {
      stagingKey: `${PREFIX}staging/other/${"a".repeat(32)}`,
    });
    const rows = await testDb.db.select().from(pendingUploads);
    expect(rows).toHaveLength(1);
    expect(rows[0].stagingKey).not.toBe(stagingKey);
  });

  it("refuses to presign past the quota (A9)", async () => {
    const d = deps();
    await fillQuotaButFor(10);
    await expect(
      presignArchiveUpload(d.common, {
        sizeBytes: 11,
        contentType: "application/zip",
      }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
  });
});

describe("confirmArchiveUpload", () => {
  it("records the archive under the owner by storage's checksum, copied inside the bucket, private", async () => {
    const d = deps();
    const body = Buffer.from("PK not really frames but bytes");
    const stagingKey = await stage(d, body);
    const result = await confirmArchiveUpload(d.common, { stagingKey });
    const md5 = createHash("md5").update(body).digest("hex");
    expect(result.key).toBe(ownerKey(userId, `r360-${md5}`, "zip", PREFIX));
    expect(result.sizeBytes).toBe(body.length);
    expect(d.objects.get(result.key)?.publicRead).toBe(false);
    expect(d.objects.get(result.key)?.body.equals(body)).toBe(true);
    // The staging copy is gone, the reservation settled.
    expect(d.objects.has(stagingKey)).toBe(false);
    const rows = await testDb.db.select().from(files);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "r360-zip",
      ext: "zip",
      sha256: `md5-${md5}`,
      sizeBytes: body.length,
      objectKey: result.key,
      parentFileId: null,
    });
  });

  it("the same archive twice is one row and one object", async () => {
    const d = deps();
    const body = Buffer.from("same bytes");
    const first = await confirmArchiveUpload(d.common, {
      stagingKey: await stage(d, body),
    });
    const second = await confirmArchiveUpload(d.common, {
      stagingKey: await stage(d, body),
    });
    expect(second.fileId).toBe(first.fileId);
    expect(await testDb.db.select().from(files)).toHaveLength(1);
    expect(d.objects.size).toBe(1);
  });

  it("re-confirming an archive already recorded passes even at the quota's edge: nothing new is stored", async () => {
    const d = deps();
    const body = Buffer.from("already here");
    await confirmArchiveUpload(d.common, { stagingKey: await stage(d, body) });
    // Staged while there was room; the quota fills before confirm runs.
    const stagingKey = await stage(d, body);
    await testDb.db.insert(files).values({
      userId,
      sha256: "filler",
      sizeBytes: QUOTA_BYTES,
      kind: "avatar-original",
      ext: "png",
    });
    await expect(
      confirmArchiveUpload(d.common, { stagingKey }),
    ).resolves.toBeTruthy();
  });

  it("refuses a key outside the caller's staging namespace, and one nothing was uploaded to", async () => {
    const d = deps();
    await expect(
      confirmArchiveUpload(d.common, {
        stagingKey: `${PREFIX}u/x/r360-abc.zip`,
      }),
    ).rejects.toMatchObject({ code: "invalid_key" });
    const { stagingKey } = await presignArchiveUpload(d.common, {
      sizeBytes: 10,
      contentType: "application/zip",
    });
    await expect(
      confirmArchiveUpload(d.common, { stagingKey }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("charges the quota at confirm against the real size, discounting its own reservation", async () => {
    const d = deps();
    await testDb.db.insert(files).values({
      userId,
      sha256: "elsewhere",
      sizeBytes: QUOTA_BYTES - 5,
      kind: "avatar-original",
      ext: "png",
    });
    const body = Buffer.from("123456");
    const stagingKey = await stage(d, Buffer.from("12345"));
    // Six bytes arrived where five were declared: the belt at confirm sees
    // the real size and refuses, discarding the staged object.
    await d.common.storage.putObject(stagingKey, body, "application/zip");
    await expect(
      confirmArchiveUpload(d.common, { stagingKey }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
    expect(d.objects.has(stagingKey)).toBe(false);
  });
});

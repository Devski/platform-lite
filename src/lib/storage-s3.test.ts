import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createS3Storage,
  IMMUTABLE_CACHE_CONTROL,
  isStorageConfigured,
  ObjectNotFoundError,
  type FileStorage,
} from "./storage";

// Real-bucket integration suite (issue #11 verification: platform-dev under
// the per-developer prefix). Gated on the S3_* environment exactly like the
// DATABASE_URL_TEST pattern in db/test-db.ts: with no configured bucket the
// suite reports as skipped, and starts running the day #2 provisions one
// (locally via .env, in CI via secrets). The gate is the storage module's own
// probe — the same S3_* list getStorage requires, maintained in one place.

const configured = isStorageConfigured();

describe.runIf(configured)("S3 storage against the real bucket", () => {
  // Lazy on purpose: beforeAll never runs when the suite is skipped, so the
  // unconfigured environment constructs nothing.
  let storage: FileStorage;
  beforeAll(() => {
    storage = createS3Storage({
      endpoint: process.env.S3_ENDPOINT!,
      region: process.env.S3_REGION!,
      bucket: process.env.S3_BUCKET!,
      accessKeyId: process.env.S3_KEY!,
      secretAccessKey: process.env.S3_SECRET!,
    });
  });
  // Unique per run, under the SPEC §4 developer prefix, cleaned up at the end.
  const prefix = `devski/test-${randomBytes(6).toString("hex")}/`;
  // Every key a test touches, registered BEFORE the attempt: cleanup must
  // cover exactly the failure cases (an upload that unexpectedly landed).
  // DeleteObject is idempotent, so deleting never-written keys is free.
  const written: string[] = [];
  const touched = (key: string): string => {
    written.push(key);
    return key;
  };

  afterAll(async () => {
    await Promise.allSettled(written.map((key) => storage.deleteObject(key)));
  });

  it("round-trips an object", async () => {
    const key = touched(`${prefix}a/roundtrip.bin`);
    const body = randomBytes(256);
    await storage.putObject(key, body, "application/octet-stream");
    expect((await storage.getObject(key)).equals(body)).toBe(true);
  });

  it("deletes for real and reports the G1 not-found contract", async () => {
    const key = touched(`${prefix}a/gone.bin`);
    await storage.putObject(key, Buffer.from("x"), "text/plain");
    await storage.deleteObject(key);
    await expect(storage.getObject(key)).rejects.toBeInstanceOf(
      ObjectNotFoundError,
    );
  });

  it("headObject reports the body's MD5 as the ETag of a single PUT, and copyObject copies privately (#72 step 5)", async () => {
    // The archive's whole identity rests on these two provider behaviours;
    // the memory fake only encodes them.
    const { createHash } = await import("node:crypto");
    const source = touched(`${prefix}staging/head-copy.zip`);
    const copy = touched(`${prefix}u/test/r360-copy.zip`);
    const body = randomBytes(2048);
    const url = await storage.presignUpload(source, {
      maxBytes: body.length,
      contentType: "application/zip",
    });
    const put = await fetch(url, {
      method: "PUT",
      headers: {
        "content-type": "application/zip",
        "content-length": String(body.length),
        "cache-control": IMMUTABLE_CACHE_CONTROL,
      },
      body,
    });
    expect(put.status).toBe(200);
    const head = await storage.headObject(source);
    expect(head).toEqual({
      sizeBytes: body.length,
      contentType: "application/zip",
      etag: createHash("md5").update(body).digest("hex"),
    });
    await storage.copyObject(source, copy, "application/zip");
    expect(await storage.headObject(copy)).toMatchObject({
      sizeBytes: body.length,
      contentType: "application/zip",
    });
    // Private: the copy is not readable at its public address.
    expect((await fetch(storage.publicUrl(copy))).status).not.toBe(200);
    await expect(storage.headObject(`${prefix}nothing`)).rejects.toBeInstanceOf(
      ObjectNotFoundError,
    );
  });

  it("accepts a presigned upload with the declared length and type (G4)", async () => {
    const key = touched(`${prefix}a/presigned.bin`);
    const body = randomBytes(512);
    const url = await storage.presignUpload(key, {
      maxBytes: body.length,
      contentType: "application/octet-stream",
    });
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": IMMUTABLE_CACHE_CONTROL,
      },
      body,
    });
    expect(response.status).toBe(200);
    expect((await storage.getObject(key)).equals(body)).toBe(true);
  });

  it("rejects a presigned upload whose byte count differs from the declaration (G4/A9)", async () => {
    const key = touched(`${prefix}a/oversized.bin`);
    const url = await storage.presignUpload(key, {
      maxBytes: 100,
      contentType: "application/octet-stream",
    });
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": IMMUTABLE_CACHE_CONTROL,
      },
      body: randomBytes(200),
    });
    expect(response.status).not.toBe(200);
    await expect(storage.getObject(key)).rejects.toThrow();
  });

  it("rejects a presigned upload with a different content type", async () => {
    const key = touched(`${prefix}a/wrong-type.bin`);
    const body = randomBytes(64);
    const url = await storage.presignUpload(key, {
      maxBytes: body.length,
      contentType: "image/webp",
    });
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "content-type": "text/plain",
        "cache-control": IMMUTABLE_CACHE_CONTROL,
      },
      body,
    });
    expect(response.status).not.toBe(200);
  });
});

describe.runIf(!configured)(
  "S3 storage against the real bucket (skipped)",
  () => {
    it("waits for the platform-dev bucket (#2) — set S3_* to enable", () => {
      expect(configured).toBe(false);
    });
  },
);

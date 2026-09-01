import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createS3Storage, IMMUTABLE_CACHE_CONTROL } from "./storage";

// Real-bucket integration suite (issue #11 verification: platform-dev under
// the per-developer prefix). Gated on the S3_* environment exactly like the
// DATABASE_URL_TEST pattern in db/test-db.ts: with no configured bucket the
// suite reports as skipped, and starts running the day #2 provisions one
// (locally via .env, in CI via secrets).

const configured = ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_KEY", "S3_SECRET"]
  .map((name) => process.env[name]?.trim())
  .every(Boolean);

describe.runIf(configured)("S3 storage against the real bucket", () => {
  const storage = configured
    ? createS3Storage({
        endpoint: process.env.S3_ENDPOINT!,
        region: process.env.S3_REGION!,
        bucket: process.env.S3_BUCKET!,
        accessKeyId: process.env.S3_KEY!,
        secretAccessKey: process.env.S3_SECRET!,
      })
    : null!;
  // Unique per run, under the SPEC §4 developer prefix, cleaned up at the end.
  const prefix = `devski/test-${randomBytes(6).toString("hex")}/`;
  const written: string[] = [];

  afterAll(async () => {
    await Promise.all(written.map((key) => storage.deleteObject(key)));
  });

  async function put(key: string, body: Buffer, contentType: string) {
    await storage.putObject(key, body, contentType);
    written.push(key);
  }

  it("round-trips an object", async () => {
    const key = `${prefix}a/roundtrip.bin`;
    const body = randomBytes(256);
    await put(key, body, "application/octet-stream");
    expect((await storage.getObject(key)).equals(body)).toBe(true);
  });

  it("deletes for real", async () => {
    const key = `${prefix}a/gone.bin`;
    await storage.putObject(key, Buffer.from("x"), "text/plain");
    await storage.deleteObject(key);
    await expect(storage.getObject(key)).rejects.toThrow();
  });

  it("accepts a presigned upload with the declared length and type (G4)", async () => {
    const key = `${prefix}a/presigned.bin`;
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
    written.push(key);
    expect((await storage.getObject(key)).equals(body)).toBe(true);
  });

  it("rejects a presigned upload whose byte count differs from the declaration (G4/A9)", async () => {
    const key = `${prefix}a/oversized.bin`;
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
    const key = `${prefix}a/wrong-type.bin`;
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

describe.runIf(!configured)("S3 storage against the real bucket (skipped)", () => {
  it("waits for the platform-dev bucket (#2) — set S3_* to enable", () => {
    expect(configured).toBe(false);
  });
});

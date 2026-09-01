import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  contentKey,
  createMemoryStorage,
  createS3Storage,
  IMMUTABLE_CACHE_CONTROL,
  isNotFound,
  ObjectNotFoundError,
} from "./storage";

// Unit suite for the G1 storage layer. Everything here runs offline: the
// presigner is pure request signing, so even the S3 implementation's URLs
// can be asserted without a bucket. The real-bucket round-trip lives in
// storage-s3.test.ts, env-gated until #2 provisions platform-dev.

describe("contentKey (G2)", () => {
  it("builds content-addressed keys under the a/ namespace", () => {
    expect(contentKey("abc123", "webp")).toBe("a/abc123.webp");
  });

  it("scopes with the per-developer or per-PR prefix", () => {
    expect(contentKey("abc123", "webp", "devski/")).toBe("devski/a/abc123.webp");
  });
});

describe("memory storage (the G1 fake for dependent code)", () => {
  it("round-trips an object with its content type", async () => {
    const { storage, objects } = createMemoryStorage();
    await storage.putObject("a/k1.webp", Buffer.from("payload"), "image/webp");
    expect((await storage.getObject("a/k1.webp")).toString()).toBe("payload");
    expect(objects.get("a/k1.webp")?.contentType).toBe("image/webp");
  });

  it("rejects a missing key with the G1 contract error", async () => {
    const { storage } = createMemoryStorage();
    await expect(storage.getObject("a/missing.bin")).rejects.toBeInstanceOf(
      ObjectNotFoundError,
    );
  });

  it("deletes idempotently", async () => {
    const { storage } = createMemoryStorage();
    await storage.putObject("a/k2.bin", Buffer.from("x"), "text/plain");
    await storage.deleteObject("a/k2.bin");
    await storage.deleteObject("a/k2.bin");
    await expect(storage.getObject("a/k2.bin")).rejects.toThrow();
  });

  it("hands out stable unsigned URLs (G3)", () => {
    const { storage } = createMemoryStorage();
    expect(storage.publicUrl("a/k3.webp")).toBe(storage.publicUrl("a/k3.webp"));
    expect(storage.publicUrl("a/k3.webp")).not.toContain("Signature");
  });

  it("issues presigned upload URLs carrying the declared constraints", async () => {
    const { storage } = createMemoryStorage();
    const url = await storage.presignUpload("a/k4.webp", {
      maxBytes: 123,
      contentType: "image/webp",
    });
    expect(url).toContain("a/k4.webp");
  });
});

describe("S3 storage (offline: URL composition and signing)", () => {
  const config = {
    endpoint: "https://s3.waw.io.cloud.ovh.net",
    region: "waw",
    bucket: "platform-dev",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
  };

  it("publicUrl is the stable unsigned path-style address (G3)", () => {
    const storage = createS3Storage(config);
    expect(storage.publicUrl("devski/a/abc.webp")).toBe(
      "https://s3.waw.io.cloud.ovh.net/platform-dev/devski/a/abc.webp",
    );
    // Stable across calls and free of any signature material.
    expect(storage.publicUrl("devski/a/abc.webp")).toBe(
      storage.publicUrl("devski/a/abc.webp"),
    );
  });

  it("tolerates a trailing slash on the configured endpoint", () => {
    const storage = createS3Storage({
      ...config,
      endpoint: "https://s3.waw.io.cloud.ovh.net/",
    });
    expect(storage.publicUrl("a/x.bin")).toBe(
      "https://s3.waw.io.cloud.ovh.net/platform-dev/a/x.bin",
    );
  });

  it("percent-encodes unsafe key characters the way the signed path does", () => {
    const storage = createS3Storage(config);
    // Nothing in this system mints such keys (contentKey is URL-safe), but a
    // hostile one must not truncate or escape the bucket path.
    expect(storage.publicUrl("a/we ird#?.bin")).toBe(
      "https://s3.waw.io.cloud.ovh.net/platform-dev/a/we%20ird%23%3F.bin",
    );
  });

  it("presignUpload signs the exact length, type and immutable cache header (G2/G4)", async () => {
    const storage = createS3Storage(config);
    const url = new URL(
      await storage.presignUpload("devski/a/abc.webp", {
        maxBytes: 4096,
        contentType: "image/webp",
      }),
    );

    expect(url.origin).toBe("https://s3.waw.io.cloud.ovh.net");
    expect(url.pathname).toBe("/platform-dev/devski/a/abc.webp");
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    // The constraints ride in the signature: an upload with a different
    // byte count, content type or cache header does not verify.
    const signedHeaders = url.searchParams.get("X-Amz-SignedHeaders") ?? "";
    expect(signedHeaders).toContain("content-length");
    expect(signedHeaders).toContain("content-type");
    expect(signedHeaders).toContain("cache-control");
  });

  it("honors a caller TTL override and keeps 600 s as the default", async () => {
    const storage = createS3Storage(config);
    const short = new URL(
      await storage.presignUpload("a/short.bin", {
        maxBytes: 10,
        contentType: "text/plain",
        expiresInSeconds: 120,
      }),
    );
    expect(short.searchParams.get("X-Amz-Expires")).toBe("120");
    const standard = new URL(
      await storage.presignUpload("a/standard.bin", {
        maxBytes: 10,
        contentType: "text/plain",
      }),
    );
    expect(standard.searchParams.get("X-Amz-Expires")).toBe("600");
  });

  it("presigned URLs differ per key and per size (no reuse across objects)", async () => {
    const storage = createS3Storage(config);
    const a = await storage.presignUpload("a/one.bin", {
      maxBytes: 10,
      contentType: "text/plain",
    });
    const b = await storage.presignUpload("a/two.bin", {
      maxBytes: 10,
      contentType: "text/plain",
    });
    const c = await storage.presignUpload("a/one.bin", {
      maxBytes: 11,
      contentType: "text/plain",
    });
    expect(new URL(a).searchParams.get("X-Amz-Signature")).not.toBe(
      new URL(b).searchParams.get("X-Amz-Signature"),
    );
    expect(new URL(a).searchParams.get("X-Amz-Signature")).not.toBe(
      new URL(c).searchParams.get("X-Amz-Signature"),
    );
  });

  it("exposes the G2 cache header constant for the delivery layer", () => {
    expect(IMMUTABLE_CACHE_CONTROL).toBe("public, max-age=31536000, immutable");
  });

  it("maps the SDK's not-found shapes to the G1 contract, nothing else", async () => {
    const { NoSuchKey } = await import("@aws-sdk/client-s3");
    expect(
      isNotFound(
        new NoSuchKey({ $metadata: {}, message: "The key does not exist." }),
      ),
    ).toBe(true);
    const quirk404 = Object.assign(new Error("not found"), {
      $metadata: { httpStatusCode: 404 },
    });
    expect(isNotFound(quirk404)).toBe(true);
    const serverError = Object.assign(new Error("boom"), {
      $metadata: { httpStatusCode: 500 },
    });
    expect(isNotFound(serverError)).toBe(false);
    expect(isNotFound(new Error("plain"))).toBe(false);
    expect(isNotFound("not even an error")).toBe(false);
  });
});

describe("getStorage environment wiring", () => {
  // A valid environment is the baseline; each test states only its deviation
  // (same convention as the getAuth suite in auth.test.ts).
  beforeEach(() => {
    vi.stubEnv("S3_ENDPOINT", "https://s3.waw.io.cloud.ovh.net");
    vi.stubEnv("S3_REGION", "waw");
    vi.stubEnv("S3_BUCKET", "platform-dev");
    vi.stubEnv("S3_KEY", "k");
    vi.stubEnv("S3_SECRET", "s");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadGetStorage() {
    vi.resetModules();
    return (await import("./storage")).getStorage;
  }

  it("builds a memoized instance from the S3_* variables", async () => {
    const getStorage = await loadGetStorage();
    const first = getStorage();
    expect(first.publicUrl("a/x.bin")).toContain("/platform-dev/");
    expect(getStorage()).toBe(first);
  });

  it.each(["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_KEY", "S3_SECRET"])(
    "fails loudly when %s is missing",
    async (name) => {
      vi.stubEnv(name, "");
      const getStorage = await loadGetStorage();
      expect(() => getStorage()).toThrow(name);
    },
  );
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  contentKey,
  createMemoryStorage,
  createS3Storage,
  IMMUTABLE_CACHE_CONTROL,
  isNotFound,
  isStorageConfigured,
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
    expect(contentKey("abc123", "webp", "devski/")).toBe(
      "devski/a/abc123.webp",
    );
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

  it("answers headObject with size, type and the body's MD5, and copies privately (#72)", async () => {
    const { storage, objects } = createMemoryStorage();
    await storage.putObject(
      "staging/u/k5.zip",
      Buffer.from("zip!"),
      "application/zip",
      {
        publicRead: true,
      },
    );
    const head = await storage.headObject("staging/u/k5.zip");
    expect(head).toMatchObject({
      sizeBytes: 4,
      contentType: "application/zip",
    });
    // MD5 of the body, as a single S3 PUT reports it.
    expect(head.etag).toMatch(/^[0-9a-f]{32}$/);
    expect((await storage.headObject("staging/u/k5.zip")).etag).toBe(head.etag);
    await storage.copyObject(
      "staging/u/k5.zip",
      "u/x/r360-abc.zip",
      "application/zip",
    );
    expect(objects.get("u/x/r360-abc.zip")).toEqual({
      body: Buffer.from("zip!"),
      contentType: "application/zip",
      publicRead: false,
    });
    await expect(storage.headObject("nope")).rejects.toBeInstanceOf(
      ObjectNotFoundError,
    );
    await expect(
      storage.copyObject("nope", "x", "application/zip"),
    ).rejects.toBeInstanceOf(ObjectNotFoundError);
  });

  it("copies publicly when asked, reads a range, and lists a prefix in key order (#102)", async () => {
    const { storage, objects } = createMemoryStorage();
    await storage.putObject(
      "staging/u/s/1600/002.webp",
      Buffer.from("RIFF..bb"),
      "image/webp",
    );
    await storage.putObject(
      "staging/u/s/1600/001.webp",
      Buffer.from("RIFF..aa"),
      "image/webp",
    );
    await storage.putObject(
      "staging/u/s/800/001.webp",
      Buffer.from("RIFF.c"),
      "image/webp",
    );
    await storage.putObject("staging/u/other", Buffer.from("x"), "text/plain");
    await storage.copyObject(
      "staging/u/s/1600/001.webp",
      "u/x/r360/s/1600/001.webp",
      "image/webp",
      { publicRead: true },
    );
    expect(objects.get("u/x/r360/s/1600/001.webp")?.publicRead).toBe(true);
    expect(
      (
        await storage.getObject("staging/u/s/1600/001.webp", {
          range: { offset: 6, length: 2 },
        })
      ).toString(),
    ).toBe("aa");
    const listed = await storage.listObjects("staging/u/s/");
    expect(listed.map((o) => o.key)).toEqual([
      "staging/u/s/1600/001.webp",
      "staging/u/s/1600/002.webp",
      "staging/u/s/800/001.webp",
    ]);
    expect(listed[0]).toMatchObject({ sizeBytes: 8 });
    expect(listed[0].etag).toMatch(/^[0-9a-f]{32}$/);
    expect(
      await storage.listObjects("staging/u/s/", { maxKeys: 2 }),
    ).toHaveLength(2);
    expect(await storage.listObjects("nothing/")).toEqual([]);
    expect(
      await storage.presignUpload("staging/u/s/1600/001.webp", {
        contentType: "image/webp",
      }),
    ).toContain("maxBytes=any");
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

  it("publicUrl is the stable unsigned virtual-host address (G3)", () => {
    const storage = createS3Storage(config);
    expect(storage.publicUrl("devski/a/abc.webp")).toBe(
      "https://platform-dev.s3.waw.io.cloud.ovh.net/devski/a/abc.webp",
    );
    // Stable across calls and free of any signature material.
    expect(storage.publicUrl("devski/a/abc.webp")).toBe(
      storage.publicUrl("devski/a/abc.webp"),
    );
  });

  it("refuses a bucket name that would break virtual-host TLS", () => {
    // The public address puts the bucket in the hostname, so a dot would land
    // the photo outside the provider's wildcard certificate. Failing at
    // construction beats emitting addresses no browser will load.
    expect(() =>
      createS3Storage({ ...config, bucket: "platform.dev" }),
    ).toThrow(/must not contain a dot/);
  });

  it("keeps the SIGNED path in path style while the public one is not", async () => {
    // Not a redundant pair: OVHcloud serves a path-style GET when it carries a
    // signature and refuses the identical anonymous one with `Not S3 request`
    // (verified against the real bucket, 04.09.2026). The two addressing
    // styles therefore have to coexist, and neither may drift into the other.
    const storage = createS3Storage(config);
    const signed = new URL(
      await storage.presignUpload("devski/a/abc.webp", {
        maxBytes: 10,
        contentType: "image/webp",
      }),
    );
    expect(signed.hostname).toBe("s3.waw.io.cloud.ovh.net");
    expect(signed.pathname).toBe("/platform-dev/devski/a/abc.webp");
    expect(new URL(storage.publicUrl("devski/a/abc.webp")).hostname).toBe(
      "platform-dev.s3.waw.io.cloud.ovh.net",
    );
  });

  it("tolerates a trailing slash on the configured endpoint", () => {
    const storage = createS3Storage({
      ...config,
      endpoint: "https://s3.waw.io.cloud.ovh.net/",
    });
    expect(storage.publicUrl("a/x.bin")).toBe(
      "https://platform-dev.s3.waw.io.cloud.ovh.net/a/x.bin",
    );
  });

  it("percent-encodes unsafe key characters the way the signed path does", () => {
    const storage = createS3Storage(config);
    // Nothing in this system mints such keys (contentKey is URL-safe), but a
    // hostile one must not truncate or escape the bucket path.
    expect(storage.publicUrl("a/we ird#?.bin")).toBe(
      "https://platform-dev.s3.waw.io.cloud.ovh.net/a/we%20ird%23%3F.bin",
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

  it("leaves the length out of the signature when the caller has none (#102)", async () => {
    const storage = createS3Storage(config);
    const url = new URL(
      await storage.presignUpload("devski/staging/u/s/1600/001.webp", {
        contentType: "image/webp",
      }),
    );
    const signedHeaders = url.searchParams.get("X-Amz-SignedHeaders") ?? "";
    expect(signedHeaders).not.toContain("content-length");
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

describe("keyPrefix (SPEC §4 scoping)", () => {
  it("passes a proper prefix through, forces the trailing slash, defaults empty", async () => {
    const fresh = await import("./storage");
    vi.stubEnv("S3_PREFIX", "devski/");
    expect(fresh.keyPrefix()).toBe("devski/");
    vi.stubEnv("S3_PREFIX", "devski");
    expect(fresh.keyPrefix()).toBe("devski/");
    vi.stubEnv("S3_PREFIX", "");
    expect(fresh.keyPrefix()).toBe("");
    vi.unstubAllEnvs();
  });
});

describe("isStorageConfigured (the S3_* probe)", () => {
  const S3_ENV = {
    S3_ENDPOINT: "https://s3.waw.io.cloud.ovh.net",
    S3_REGION: "waw",
    S3_BUCKET: "platform-dev",
    S3_KEY: "k",
    S3_SECRET: "s",
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is true when all five variables are set", () => {
    for (const [name, value] of Object.entries(S3_ENV)) {
      vi.stubEnv(name, value);
    }
    expect(isStorageConfigured()).toBe(true);
  });

  it("is false when one of them is blank — the same names getStorage requires", () => {
    for (const [name, value] of Object.entries(S3_ENV)) {
      vi.stubEnv(name, value);
    }
    vi.stubEnv("S3_SECRET", "   ");
    expect(isStorageConfigured()).toBe(false);
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
    expect(first.publicUrl("a/x.bin")).toContain("//platform-dev.s3.");
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

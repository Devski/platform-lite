import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireEnv } from "@/lib/env";

// The ONLY file that talks to S3 — same principle as lib/email.ts for mail
// (SPEC.md G1); an ESLint no-restricted-imports rule keeps the SDK out of
// every other module. Everything stored here is content-addressed (G2), so
// every object carries the immutable cache header and public reads go through
// stable, unsigned URLs (G3); signatures exist only on uploads (G4).

// Thrown by getObject when the key does not exist, by every implementation —
// callers above the G1 line can tell "never uploaded" (a 4xx) from a storage
// outage (a 5xx/retry) without touching the SDK's error types.
export class ObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`no such key: ${key}`);
    this.name = "ObjectNotFoundError";
  }
}

export interface FileStorage {
  /**
   * Signed one-key upload URL (G4). `maxBytes` is signed as the EXACT
   * Content-Length the uploader must send — pass the client-declared size,
   * not a ceiling; the URL cannot move more (or fewer) bytes. The uploader
   * must also send the declared Content-Type and
   * `Cache-Control: IMMUTABLE_CACHE_CONTROL` — all three ride the signature.
   * The payload itself is NOT signed and the URL stays valid for multiple
   * requests until it expires (600 s unless the caller passes a shorter
   * `expiresInSeconds`), so callers must verify the uploaded bytes
   * server-side before publishing anything under a content-addressed key
   * (upload to a staging key, verify, copy — the #12 contract).
   */
  presignUpload(
    key: string,
    opts: { maxBytes: number; contentType: string; expiresInSeconds?: number },
  ): Promise<string>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Rejects with ObjectNotFoundError when the key does not exist. */
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  /** Stable, unsigned address of a public object (G3). */
  publicUrl(key: string): string;
}

// G2: content-addressed name → served forever-cacheable. Defined in the
// client-safe module (uploaders must send it); re-exported here for the
// server-side callers.
export { IMMUTABLE_CACHE_CONTROL } from "@/lib/storage-shared";
import { IMMUTABLE_CACHE_CONTROL } from "@/lib/storage-shared";

export function contentKey(hash: string, ext: string, prefix = ""): string {
  // G2: the name IS the content hash, so a changed file is a new URL and the
  // old one can be cached for a year. Keys use only URL-safe characters
  // (hex hash, known extensions, the per-developer/PR prefix from SPEC §4).
  return `${prefix}a/${hash}.${ext}`;
}

// SPEC §4: dev and PR environments scope their keys (`devski/`, `pr-7/`);
// production uses the bare bucket. Optional on purpose — requireEnv would
// make the empty production value an error. The trailing slash is enforced,
// so `S3_PREFIX=devski` cannot silently fuse into `devskia/...` keys (and a
// future by-prefix cleanup cannot match `pr-70/` when it means `pr-7/`).
export function keyPrefix(): string {
  const prefix = process.env.S3_PREFIX?.trim() ?? "";
  if (prefix === "" || prefix.endsWith("/")) return prefix;
  return `${prefix}/`;
}

const PRESIGN_EXPIRES_SECONDS = 600;

// Normalizes the SDK's not-found (and any provider 404 quirk) into the G1
// contract error — here, in the one module allowed to know the SDK's shapes.
// Exported for its unit tests only.
export function isNotFound(error: unknown): boolean {
  if (error instanceof NoSuchKey) return true;
  return (
    error instanceof Error &&
    "$metadata" in error &&
    (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404
  );
}

export function createS3Storage(config: {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}): FileStorage {
  const endpoint = config.endpoint.replace(/\/+$/, "");
  const { bucket } = config;
  const client = new S3Client({
    endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Path-style addressing works on every S3-compatible provider and keeps
    // publicUrl trivially derivable from the same endpoint.
    forcePathStyle: true,
    // Without this the SDK pins x-amz-checksum-crc32 of an EMPTY body into
    // every presigned PUT (the body does not exist at presign time), which a
    // checksum-validating bucket would then reject for any real upload.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });

  return {
    async presignUpload(key, opts) {
      // G4: the browser uploads straight to S3 with this URL; the app server
      // never carries the bytes. The signature pins the byte count (callers
      // pass the client-declared size — the URL cannot move more, or fewer,
      // bytes than declared), the content type, and the G2 cache header, so
      // a tampered upload fails verification at the bucket.
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: opts.contentType,
        ContentLength: opts.maxBytes,
        CacheControl: IMMUTABLE_CACHE_CONTROL,
      });
      return getSignedUrl(client, command, {
        expiresIn: opts.expiresInSeconds ?? PRESIGN_EXPIRES_SECONDS,
        // Verified against the installed SDK (3.1121): by default only
        // content-length;host end up signed — the presigner marks
        // content-type unsignable and SigV4 always excludes cache-control.
        // signableHeaders is the documented override that forces both back
        // into the signature (nothing hoists non-x-amz headers to the query,
        // so they stay request headers the uploader must send). Net result:
        // X-Amz-SignedHeaders=cache-control;content-length;content-type;host,
        // and a request differing in any of them fails verification.
        signableHeaders: new Set([
          "content-length",
          "content-type",
          "cache-control",
        ]),
      });
    },

    async putObject(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: IMMUTABLE_CACHE_CONTROL,
        }),
      );
    },

    async getObject(key) {
      let response;
      try {
        response = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
      } catch (error) {
        if (isNotFound(error)) throw new ObjectNotFoundError(key);
        throw error;
      }
      if (!response.Body) {
        throw new Error(`empty S3 response body for key: ${key}`);
      }
      return Buffer.from(await response.Body.transformToByteArray());
    },

    async deleteObject(key) {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    },

    publicUrl(key) {
      // Encoded per segment exactly like the SDK encodes the signed path, so
      // the public address always names the object the upload created — an
      // identity transform for the URL-safe keys contentKey produces.
      const encodedKey = key.split("/").map(encodeURIComponent).join("/");
      return `${endpoint}/${bucket}/${encodedKey}`;
    },
  };
}

// Test/dev double implementing the same contract, so code above the G1 line
// (avatar upload #12, quota #13, profiles #14) tests without any bucket —
// the same move as createMemoryTransport in lib/email.ts.
export function createMemoryStorage(): {
  storage: FileStorage;
  objects: Map<string, { body: Buffer; contentType: string }>;
} {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  return {
    objects,
    storage: {
      async presignUpload(key, opts) {
        // Not fetchable — dependent tests either assert the URL or write
        // through putObject directly.
        return `memory://upload/${key}?maxBytes=${opts.maxBytes}&contentType=${encodeURIComponent(opts.contentType)}`;
      },
      async putObject(key, body, contentType) {
        objects.set(key, { body, contentType });
      },
      async getObject(key) {
        const stored = objects.get(key);
        if (!stored) throw new ObjectNotFoundError(key);
        return stored.body;
      },
      async deleteObject(key) {
        objects.delete(key);
      },
      publicUrl(key) {
        return `memory://${key}`;
      },
    },
  };
}

let instance: FileStorage | undefined;

export function getStorage(): FileStorage {
  if (!instance) {
    instance = createS3Storage({
      endpoint: requireEnv("S3_ENDPOINT"),
      region: requireEnv("S3_REGION"),
      bucket: requireEnv("S3_BUCKET"),
      accessKeyId: requireEnv("S3_KEY"),
      secretAccessKey: requireEnv("S3_SECRET"),
    });
  }
  return instance;
}

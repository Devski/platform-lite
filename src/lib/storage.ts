import {
  DeleteObjectCommand,
  GetObjectCommand,
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

export interface FileStorage {
  presignUpload(
    key: string,
    opts: { maxBytes: number; contentType: string },
  ): Promise<string>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  /** Stable, unsigned address of a public object (G3). */
  publicUrl(key: string): string;
}

// G2: content-addressed name → served forever-cacheable.
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function contentKey(hash: string, ext: string, prefix = ""): string {
  // G2: the name IS the content hash, so a changed file is a new URL and the
  // old one can be cached for a year. Keys use only URL-safe characters
  // (hex hash, known extensions, the per-developer/PR prefix from SPEC §4).
  return `${prefix}a/${hash}.${ext}`;
}

const PRESIGN_EXPIRES_SECONDS = 600;

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
        expiresIn: PRESIGN_EXPIRES_SECONDS,
        // Verified against the installed SDK (3.1121): by default only
        // content-length;host end up signed. signableHeaders forces the type
        // and cache header INTO the signature, and unhoistableHeaders keeps
        // them as request headers the uploader must actually send — X-Amz-
        // SignedHeaders comes out cache-control;content-length;content-type;
        // host, so a request differing in any of them fails verification.
        signableHeaders: new Set([
          "content-length",
          "content-type",
          "cache-control",
        ]),
        unhoistableHeaders: new Set(["content-type", "cache-control"]),
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
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
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
      return `${endpoint}/${bucket}/${key}`;
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
        if (!stored) throw new Error(`no such key: ${key}`);
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

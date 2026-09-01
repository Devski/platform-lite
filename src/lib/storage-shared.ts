// Client-safe piece of the storage layer: the browser must send this exact
// header with a presigned PUT (it rides the signature), but importing
// storage.ts would pull the S3 SDK into the bundle. storage.ts re-exports it.
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

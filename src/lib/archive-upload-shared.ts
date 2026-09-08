import { z } from "zod";

// Client-safe piece of the R360 archive upload (#72 / A12): the browser
// validates with the constants the server enforces (§5). No size limit by
// decision (08.09.2026) — the one ceiling is S3's own, a single PUT of at
// most 5 GiB; #68 processes the frames down so storage holds.
export const ARCHIVE_MAX_BYTES = 5 * 1024 * 1024 * 1024;
// What browsers call a zip: the two registered types, and the fallback
// some of them send for any download. The bytes are checked by #68 when
// it opens the archive; here the declaration only rides the signature.
export const ARCHIVE_CONTENT_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
] as const;

export const presignArchiveSchema = z.object({
  sizeBytes: z.number().int().min(1).max(ARCHIVE_MAX_BYTES),
  contentType: z.enum(ARCHIVE_CONTENT_TYPES),
});

export const confirmArchiveSchema = z.object({
  stagingKey: z.string().min(1),
});

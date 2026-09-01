import { z } from "zod";

// Client-safe piece of the avatar pipeline: the settings form validates with
// the same constants and schema the server enforces (§5), but importing
// avatar.ts would pull sharp into the bundle. avatar.ts re-exports these.

// A4: JPEG/PNG/WebP up to 10 MB.
export const AVATAR_MAX_BYTES = 10 * 1024 * 1024;
export const AVATAR_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const presignAvatarSchema = z.object({
  sizeBytes: z.number().int().min(1).max(AVATAR_MAX_BYTES),
  contentType: z.enum(AVATAR_CONTENT_TYPES),
});

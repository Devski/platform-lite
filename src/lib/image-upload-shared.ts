import { z } from "zod";
import type { fileKind } from "@/db/schema";

// Client-safe piece of the image pipeline: the browser validates with the
// same constants and schemas the server enforces (§5), but importing
// image-upload.ts would pull sharp into the bundle. image-upload.ts
// re-exports these.

// A4 (and A12, which reuses it): JPEG/PNG/WebP up to 10 MB.
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// #72: what an uploaded image is FOR decides how it is published — square
// crops for the avatar, width-bound variants that keep the aspect ratio for
// the cover and a work's photos (A12).
export const IMAGE_PURPOSES = ["avatar", "cover", "work"] as const;
export type ImagePurpose = (typeof IMAGE_PURPOSES)[number];
export const imagePurposeSchema = z.enum(IMAGE_PURPOSES);

export const presignImageSchema = z.object({
  sizeBytes: z.number().int().min(1).max(IMAGE_MAX_BYTES),
  contentType: z.enum(IMAGE_CONTENT_TYPES),
});

export const confirmImageSchema = z.object({
  stagingKey: z.string().min(1),
  purpose: imagePurposeSchema,
});

type FileKind = (typeof fileKind.enumValues)[number];

export interface ImageVariantSpec {
  kind: FileKind;
  /** The square side for `cover`, the width bound for `inside`. */
  size: number;
  /** cover: centre-cropped square (the avatar chip); inside: the width
   * bound, never enlarged, aspect ratio kept (A12). */
  fit: "cover" | "inside";
}

export interface ImageProfile {
  originalKind: FileKind;
  variants: readonly ImageVariantSpec[];
}

// G5/A4/A12: what each purpose publishes — the one table lib/profile reads
// the slots from too, so a size can only change in one place. Variant
// objects are named by the ORIGINAL hash plus the size, so a cover and a
// work photo with the same bytes and the same bound share an object — same
// pixels, one key — and the key-based liveness check in lib/profile keeps
// it as long as either references it.
export const IMAGE_PROFILES: Record<ImagePurpose, ImageProfile> = {
  avatar: {
    originalKind: "avatar-original",
    variants: [
      { kind: "avatar-512", size: 512, fit: "cover" },
      { kind: "avatar-128", size: 128, fit: "cover" },
    ],
  },
  cover: {
    originalKind: "cover-original",
    variants: [
      { kind: "cover-1600", size: 1600, fit: "inside" },
      { kind: "cover-480", size: 480, fit: "inside" },
    ],
  },
  work: {
    originalKind: "work-original",
    variants: [
      { kind: "work-1600", size: 1600, fit: "inside" },
      { kind: "work-480", size: 480, fit: "inside" },
    ],
  },
};

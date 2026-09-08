import {
  confirmImageUpload,
  ImageUploadError,
  presignImageUpload,
  type ImageUploadDeps,
} from "@/lib/image-upload";

// The avatar's names for the shared image pipeline (#12). The pipeline
// itself moved to image-upload.ts with #72, when the cover and the work
// photos started using it; these wrappers keep the avatar's test suite —
// the one that proves the staging contract, the decode-verify and the
// quota — reading as it did. Nothing at runtime imports them.

export { IMAGE_MAX_BYTES as AVATAR_MAX_BYTES } from "@/lib/image-upload-shared";
export const AvatarUploadError = ImageUploadError;
export type AvatarUploadError = ImageUploadError;
export type AvatarDeps = ImageUploadDeps;

export const presignAvatarUpload = presignImageUpload;

export function confirmAvatarUpload(
  deps: AvatarDeps,
  input: { stagingKey: string },
) {
  return confirmImageUpload(deps, { ...input, purpose: "avatar" });
}

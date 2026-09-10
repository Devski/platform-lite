import sharp from "sharp";
import {
  confirmImageUpload,
  presignImageUpload,
  type ImageUploadDeps,
} from "@/lib/image-upload";

// The one way a test puts a confirmed photo on an account
// (as src/db/test-account.ts is for the account itself): through the real
// presign → PUT → confirm contract of #12, against the memory storage fake.
// works.test.ts and r360/frame-set.test.ts used to carry a copy each.

export async function uploadTestPhoto(
  deps: ImageUploadDeps,
  options: {
    /** Tints the pixels, so two photos never confirm to the same bytes. */
    seed: number;
    purpose?: "work" | "cover";
    width?: number;
    height?: number;
  },
) {
  const image = await sharp({
    create: {
      width: options.width ?? 800,
      height: options.height ?? 600,
      channels: 3,
      background: { r: options.seed % 255, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
  const { stagingKey } = await presignImageUpload(deps, {
    sizeBytes: image.length,
    contentType: "image/png",
  });
  await deps.storage.putObject(stagingKey, image, "image/png");
  return confirmImageUpload(deps, {
    stagingKey,
    purpose: options.purpose ?? "work",
  });
}

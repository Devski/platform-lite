import sharp from "sharp";
import {
  confirmArchiveUpload,
  presignArchiveUpload,
} from "@/lib/archive-upload";
import {
  confirmImageUpload,
  presignImageUpload,
  type ImageUploadDeps,
} from "@/lib/image-upload";

// The one way a test puts a confirmed photo or R360 archive on an account
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

/** A few bytes that pass for an archive: the app never opens one (A12). */
export async function uploadTestArchive(deps: ImageUploadDeps, seed: string) {
  const body = Buffer.from(`PK archive ${seed}`);
  const { stagingKey } = await presignArchiveUpload(deps, {
    sizeBytes: body.length,
    contentType: "application/zip",
  });
  await deps.storage.putObject(stagingKey, body, "application/zip");
  return confirmArchiveUpload(deps, { stagingKey });
}

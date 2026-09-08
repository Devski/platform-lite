import { NextResponse } from "next/server";
import { ArchiveUploadError } from "@/lib/archive-upload";
import { ImageUploadError } from "@/lib/image-upload";

// Shared by the upload routes: run the pipeline step, serialize the result,
// and turn its typed rejections into 400s with stable codes (the owner's
// page words them in pl/en). Anything else stays a real error.
export async function respondWithUploadResult(
  run: () => Promise<unknown>,
): Promise<NextResponse> {
  try {
    return NextResponse.json((await run()) ?? { ok: true });
  } catch (error) {
    if (
      error instanceof ImageUploadError ||
      error instanceof ArchiveUploadError
    ) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }
}

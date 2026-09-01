import { NextResponse } from "next/server";
import { AvatarUploadError } from "@/lib/avatar";

// Shared by the two avatar routes: run the pipeline step, serialize the
// result, and turn its typed rejections into 400s with stable codes (the #14
// UI words them in pl/en). Anything else stays a real error.
export async function respondWithAvatarResult(
  run: () => Promise<unknown>,
): Promise<NextResponse> {
  try {
    return NextResponse.json(await run());
  } catch (error) {
    if (error instanceof AvatarUploadError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }
}

import { NextResponse } from "next/server";
import { FrameSetError } from "@/lib/r360/frame-set";
import { WorksError } from "@/lib/works";

// Shared by the works routes: run the step, serialize the result, and turn
// the typed rejections into stable-coded responses — 404 for a work that is
// not the caller's (or gone), 400 for the rest. Anything else stays an error.
export async function respondWithWorkResult(
  run: () => Promise<unknown>,
): Promise<NextResponse> {
  try {
    const result = await run();
    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    if (error instanceof WorksError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    // #102: the frame set named by the save did not check out.
    if (error instanceof FrameSetError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, parseJsonBody, sessionUserId } from "@/lib/api-route";
import { AvatarUploadError, confirmAvatarUpload } from "@/lib/avatar";
import { getDb } from "@/db/client";
import { getStorage, keyPrefix } from "@/lib/storage";

// Step two of the #12 avatar flow: verify the staged bytes server-side and
// publish original + WebP variants under content-addressed keys. Rejections
// come back as stable codes; the #14 UI maps them to pl/en copy.

const confirmSchema = z.object({ stagingKey: z.string().min(1) });

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Tighter than presign: each confirm decodes and re-encodes up to 10 MB.
  if (!checkRateLimit(`avatar-confirm:${userId}`, { windowSeconds: 60, max: 5 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, confirmSchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await confirmAvatarUpload(
      { storage: getStorage(), db: getDb(), prefix: keyPrefix(), userId },
      input,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AvatarUploadError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }
}

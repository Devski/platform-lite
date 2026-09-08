import { NextResponse } from "next/server";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { confirmImageSchema, confirmImageUpload } from "@/lib/image-upload";
import { getDb } from "@/db/client";
import { getStorage, keyPrefix } from "@/lib/storage";
import { respondWithUploadResult } from "../respond";

// Step two of the image flow: verify the staged bytes server-side and
// publish the original plus the purpose's WebP variants under the owner's
// content-addressed keys.

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  // Tighter than presign: each confirm decodes and re-encodes up to 10 MB.
  if (
    !checkRateLimit(`upload-confirm:${userId}`, { windowSeconds: 60, max: 15 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, confirmImageSchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return respondWithUploadResult(() =>
    confirmImageUpload(
      { storage: getStorage(), db: getDb(), prefix: keyPrefix(), userId },
      input,
    ),
  );
}

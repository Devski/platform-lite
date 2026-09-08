import { NextResponse } from "next/server";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { getDb } from "@/db/client";
import { presignImageSchema, presignImageUpload } from "@/lib/image-upload";
import { getStorage, keyPrefix } from "@/lib/storage";
import { respondWithUploadResult } from "../respond";

// Step one of the image flow (#12, for every purpose since #72):
// authenticate, validate the A4 edge, hand back a short-lived staging
// upload URL. Thin by design — the logic lives in lib/image-upload.ts,
// tested against the memory fake.

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (
    !checkRateLimit(`upload-presign:${userId}`, { windowSeconds: 60, max: 10 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, presignImageSchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return respondWithUploadResult(() =>
    presignImageUpload(
      { storage: getStorage(), db: getDb(), prefix: keyPrefix(), userId },
      input,
    ),
  );
}

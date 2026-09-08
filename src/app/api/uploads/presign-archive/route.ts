import { NextResponse } from "next/server";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import {
  presignArchiveSchema,
  presignArchiveUpload,
} from "@/lib/archive-upload";
import { getDb } from "@/db/client";
import { getStorage, keyPrefix } from "@/lib/storage";
import { respondWithUploadResult } from "../respond";

// #72 / A12: step one for an R360 archive — reserve the declared bytes and
// hand back a staging upload URL. No size limit beyond S3's single PUT.

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  // Archives are big and rare: a handful a minute is plenty.
  if (
    !checkRateLimit(`archive-presign:${userId}`, { windowSeconds: 60, max: 5 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, presignArchiveSchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return respondWithUploadResult(() =>
    presignArchiveUpload(
      { storage: getStorage(), db: getDb(), prefix: keyPrefix(), userId },
      input,
    ),
  );
}

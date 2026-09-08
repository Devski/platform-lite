import { NextResponse } from "next/server";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import {
  confirmArchiveSchema,
  confirmArchiveUpload,
} from "@/lib/archive-upload";
import { getDb } from "@/db/client";
import { getStorage, keyPrefix } from "@/lib/storage";
import { respondWithUploadResult } from "../respond";

// #72 / A12: step two for an R360 archive — size and checksum from storage,
// a copy to the final key inside the bucket, a files row. The archive is
// never read by this process.

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (
    !checkRateLimit(`archive-confirm:${userId}`, { windowSeconds: 60, max: 5 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, confirmArchiveSchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return respondWithUploadResult(() =>
    confirmArchiveUpload(
      { storage: getStorage(), db: getDb(), prefix: keyPrefix(), userId },
      input,
    ),
  );
}

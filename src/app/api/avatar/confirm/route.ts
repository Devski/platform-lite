import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { confirmAvatarUpload } from "@/lib/avatar";
import { getDb } from "@/db/client";
import { getStorage, keyPrefix } from "@/lib/storage";
import { respondWithAvatarResult } from "../respond";

// Step two of the #12 avatar flow: verify the staged bytes server-side and
// publish original + WebP variants under content-addressed keys.

const confirmSchema = z.object({ stagingKey: z.string().min(1) });

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  // Tighter than presign: each confirm decodes and re-encodes up to 10 MB.
  if (
    !checkRateLimit(`avatar-confirm:${userId}`, { windowSeconds: 60, max: 5 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, confirmSchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return respondWithAvatarResult(() =>
    confirmAvatarUpload(
      { storage: getStorage(), db: getDb(), prefix: keyPrefix(), userId },
      input,
    ),
  );
}

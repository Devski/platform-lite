import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { getDb } from "@/db/client";
import { claimArchive } from "@/lib/r360/archive-resume";
import { getStorage, keyPrefix } from "@/lib/storage";
import { respondWithUploadResult } from "../respond";

// #105 / A13: claim an archive that reached the bucket and get a signed,
// short-lived address to read the frames from again. A handful a minute:
// each claim is a session's worth of reading.

const resumeArchiveSchema = z.object({ fileId: z.uuid() });

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (
    !checkRateLimit(`archive-resume:${userId}`, { windowSeconds: 60, max: 5 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const input = await parseJsonBody(request, resumeArchiveSchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  return respondWithUploadResult(() =>
    claimArchive(
      { db: getDb(), storage: getStorage(), prefix: keyPrefix(), userId },
      input,
    ),
  );
}

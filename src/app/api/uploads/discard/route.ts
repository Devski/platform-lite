import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { getDb } from "@/db/client";
import { getStorage, keyPrefix } from "@/lib/storage";
import { discardWorkFile } from "@/lib/works";
import { respondWithWorkResult } from "../../works/respond";

// #72: free a confirmed work photo or R360 archive that never made it onto
// a work — the owner closed the form after uploading. A file a work still
// names is left alone; the quota would otherwise keep charging for an
// orphan.

const bodySchema = z.object({ fileId: z.uuid() });

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (
    !checkRateLimit(`upload-discard:${userId}`, { windowSeconds: 60, max: 30 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, bodySchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return respondWithWorkResult(() =>
    discardWorkFile(
      { db: getDb(), storage: getStorage(), prefix: keyPrefix(), userId },
      input.fileId,
    ),
  );
}

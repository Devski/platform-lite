import { NextResponse } from "next/server";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { getDb } from "@/db/client";
import { presignFrameSet } from "@/lib/r360/frame-set";
import { presignFrameSetSchema } from "@/lib/r360/frame-set-shared";
import { getStorage, keyPrefix } from "@/lib/storage";
import { respondWithUploadResult } from "../respond";

// #102 / A13: one batch presign per R360 frame set — the set id, #30's
// reservation for the whole set, and the 2N staging URLs at once. Its own
// limit, per set: the per-upload limit would take twelve minutes for a
// 120-frame set, and a set is minted once per archive picked.
//
// Ten a minute, the avatar's and the cover's figure (Dawid, 11.09.2026).
// It was three, and an owner who stops an orbit and picks another zip
// spends two: trying #148's fix, the second round in a minute was refused.
// What bounds the reservations is the quota each of them counts against,
// not this limit.

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (
    !checkRateLimit(`r360-presign:${userId}`, { windowSeconds: 60, max: 10 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, presignFrameSetSchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return respondWithUploadResult(() =>
    presignFrameSet(
      { storage: getStorage(), db: getDb(), prefix: keyPrefix(), userId },
      input,
    ),
  );
}

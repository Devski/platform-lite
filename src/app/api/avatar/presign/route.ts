import { NextResponse } from "next/server";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { presignAvatarSchema, presignAvatarUpload } from "@/lib/avatar";
import { getDb } from "@/db/client";
import { getStorage, keyPrefix } from "@/lib/storage";
import { respondWithAvatarResult } from "../respond";

// Step one of the #12 avatar flow: authenticate, validate the A4 edge, hand
// back a short-lived staging upload URL. Thin by design — the logic lives in
// lib/avatar.ts, tested against the memory fake.

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (
    !checkRateLimit(`avatar-presign:${userId}`, { windowSeconds: 60, max: 10 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, presignAvatarSchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return respondWithAvatarResult(() =>
    presignAvatarUpload(
      { storage: getStorage(), db: getDb(), prefix: keyPrefix(), userId },
      input,
    ),
  );
}

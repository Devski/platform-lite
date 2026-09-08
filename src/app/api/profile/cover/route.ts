import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { getDb } from "@/db/client";
import { ProfileError, setCover } from "@/lib/profile";
import { getStorage, keyPrefix } from "@/lib/storage";

// #72: point the profile at a confirmed cover-original file, or at nothing
// (fileId: null takes the cover down). Replacement cleanup (old rows +
// unshared objects) happens inside lib/profile, as for the avatar.

const bodySchema = z.object({ fileId: z.uuid().nullable() });

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (
    !checkRateLimit(`profile-cover:${userId}`, { windowSeconds: 60, max: 10 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, bodySchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    await setCover(
      { db: getDb(), storage: getStorage(), prefix: keyPrefix(), userId },
      input.fileId,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProfileError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }
}

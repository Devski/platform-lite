import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, parseJsonBody, sessionUserId } from "@/lib/api-route";
import { getDb } from "@/db/client";
import { ProfileError, setAvatar } from "@/lib/profile";
import { getStorage, keyPrefix } from "@/lib/storage";

// #14: point the profile at a confirmed avatar-original file. Replacement
// cleanup (old rows + unshared objects) happens inside lib/profile.

const bodySchema = z.object({ fileId: z.uuid() });

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!checkRateLimit(`profile-avatar:${userId}`, { windowSeconds: 60, max: 10 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, bodySchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    await setAvatar(
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

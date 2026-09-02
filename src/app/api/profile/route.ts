import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { getDb } from "@/db/client";
import { displayNameSchema } from "@/lib/profile-schemas";
import { updateDisplayName } from "@/lib/profile";

// #14: display-name upsert. Thin; the logic and validation live in
// lib/profile (the schema is shared with the settings form).

const bodySchema = z.object({ displayName: displayNameSchema });

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (!checkRateLimit(`profile:${userId}`, { windowSeconds: 60, max: 20 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, bodySchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await updateDisplayName({ db: getDb(), userId }, input.displayName);
  return NextResponse.json({ ok: true });
}

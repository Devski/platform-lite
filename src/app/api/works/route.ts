import { NextResponse } from "next/server";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { getDb } from "@/db/client";
import { getStorage, keyPrefix } from "@/lib/storage";
import { workInputSchema } from "@/lib/work-schemas";
import { createWork } from "@/lib/works";
import { respondWithWorkResult } from "./respond";

// #72 / A12: add a work. The photos named in the body are confirmed
// work-original files of the caller (lib/works checks); the ten-per-profile
// limit is counted there too.

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (!checkRateLimit(`works:${userId}`, { windowSeconds: 60, max: 30 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, workInputSchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return respondWithWorkResult(() =>
    createWork(
      { db: getDb(), storage: getStorage(), prefix: keyPrefix(), userId },
      input,
    ),
  );
}

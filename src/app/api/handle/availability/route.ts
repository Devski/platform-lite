import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { checkRateLimit, sessionUserId } from "@/lib/api-route";
import { normalizeHandle } from "@/lib/handle";
import { getHandleState, handleAvailability } from "@/lib/profile-handle";

// #15: the live availability check behind the handle picker. Thin on
// purpose — normalization and the A5 rules live in lib/handle, the lookup in
// lib/profile-handle. Session-gated and per-user limited like every /api
// route: the reserved list is public anyway, but "taken or free" is an
// enumeration oracle nobody needs sixty times a minute.

// Room for the form's raw input above the A5 maximum (30); anything longer
// is a probe, not a typo.
const QUERY_MAX = 64;

export async function GET(request: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (
    !checkRateLimit(`handle-availability:${userId}`, {
      windowSeconds: 60,
      max: 60,
    })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const handle = request.nextUrl.searchParams.get("handle");
  if (!handle || handle.length > QUERY_MAX) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const db = getDb();
  const [availability, state] = await Promise.all([
    handleAvailability(db, handle),
    getHandleState(db, userId),
  ]);
  // The caller's own handle reads as taken (it IS in the unique index); the
  // form turns `own` into "this is your current address", not a conflict.
  const own = normalizeHandle(handle) === state.handle;
  return NextResponse.json(own ? { ...availability, own: true } : availability);
}

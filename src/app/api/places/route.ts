import { NextResponse } from "next/server";
import { checkRateLimit, sessionUserId } from "@/lib/api-route";
import { getDb } from "@/db/client";
import { LOCATION_MAX } from "@/lib/profile-schemas";
import { PLACE_QUERY_MIN, searchPlaces } from "@/lib/places";

// #87 / A12: suggestions for the place field, from the TERYT rows in the
// database. Behind the session — only the owner's page asks — and
// rate-limited per user, wide enough that typing can never reach it: the
// field asks 250 ms after the typing pauses.

export async function GET(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!checkRateLimit(`places:${userId}`, { windowSeconds: 60, max: 300 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").slice(0, LOCATION_MAX);
  if (query.trim().length < PLACE_QUERY_MIN) {
    return NextResponse.json({ places: [] });
  }
  const exclude = url.searchParams
    .getAll("exclude")
    .slice(0, 16)
    .map((value) => value.slice(0, LOCATION_MAX));
  const places = await searchPlaces(getDb(), query, { exclude, limit: 10 });
  return NextResponse.json(
    { places },
    { headers: { "cache-control": "private, no-store" } },
  );
}

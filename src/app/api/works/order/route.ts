import { NextResponse } from "next/server";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { getDb } from "@/db/client";
import { worksOrderSchema } from "@/lib/work-schemas";
import { reorderWorks } from "@/lib/works";
import { respondWithWorkResult } from "../respond";

// #66 / A12: the order the owner dragged their works into. The body names
// every work they have, first to last, and lib/works refuses an order about
// any other list — see reorderWorks.
//
// A dragged list saves on every drop, so the limit is looser than the one on
// adding a work: a minute of steady reordering is a plausible thing to do,
// a hundred of them in that minute is not.

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (
    !checkRateLimit(`works-order:${userId}`, { windowSeconds: 60, max: 60 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, worksOrderSchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return respondWithWorkResult(async () => {
    await reorderWorks({ db: getDb(), userId }, input.workIds);
  });
}

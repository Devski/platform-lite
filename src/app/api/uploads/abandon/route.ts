import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { getDb } from "@/db/client";
import { abandonStagedUpload } from "@/lib/image-upload";
import { getStorage, keyPrefix } from "@/lib/storage";

// #72 step 5: the browser gave up on a staged upload (the PUT failed, or
// the owner cancelled a transfer). Settles the reservation now, so the
// declared bytes stop counting at once rather than at the window's end.
// Answers ok for anything in the caller's namespace, including a key it
// never saw: idempotent, and a retry costs nothing.

const bodySchema = z.object({ stagingKey: z.string().min(1) });

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (
    !checkRateLimit(`upload-abandon:${userId}`, { windowSeconds: 60, max: 30 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, bodySchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await abandonStagedUpload(
    { storage: getStorage(), db: getDb(), prefix: keyPrefix(), userId },
    input,
  );
  return NextResponse.json({ ok: true });
}

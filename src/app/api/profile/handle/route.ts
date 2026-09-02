import { NextResponse } from "next/server";
import { z } from "zod";
import { getPathname } from "@/i18n/navigation";
import { localeFromRequest } from "@/i18n/request-locale";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { getDb, type Database } from "@/db/client";
import { appOrigin } from "@/lib/env";
import {
  HandleError,
  notifyHandleChanged,
  setHandle,
} from "@/lib/profile-handle";

// #15: set or change the caller's handle. The body schema only bounds the
// raw string — normalization, the A5 rules, uniqueness and the A6 cooldown
// are decided inside lib/profile-handle; the route maps its error codes to
// statuses and nothing more. #16: a change also sends the A10 notice.

const bodySchema = z.object({ handle: z.string().min(1).max(64) });

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (
    !checkRateLimit(`profile-handle:${userId}`, { windowSeconds: 60, max: 10 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, bodySchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const db = getDb();
  try {
    const { handle, previousHandle } = await setHandle(
      db,
      userId,
      input.handle,
    );
    if (previousHandle !== null) {
      await notifyChange(db, request, {
        userId,
        oldHandle: previousHandle,
        newHandle: handle,
      });
    }
    return NextResponse.json({ ok: true, handle });
  } catch (error) {
    if (error instanceof HandleError) {
      if (error.code === "cooldown") {
        return NextResponse.json(
          { error: "cooldown", retryAt: error.retryAt?.toISOString() ?? null },
          { status: 409 },
        );
      }
      // invalid/reserved fault the caller's input (400); taken is a conflict
      // with another profile's row (409).
      return NextResponse.json(
        { error: error.code },
        { status: error.code === "taken" ? 409 : 400 },
      );
    }
    throw error;
  }
}

// A10: the handle-change notice, sent once the transaction committed and
// best-effort — the same stance as the password-changed notice in lib/auth:
// the change stands, a failed delivery is logged.
async function notifyChange(
  db: Database,
  request: Request,
  change: { userId: string; oldHandle: string; newHandle: string },
): Promise<void> {
  const locale = localeFromRequest(request);
  try {
    await notifyHandleChanged(db, {
      ...change,
      locale,
      profileUrl: `${appOrigin()}${getPathname({ href: `/${change.newHandle}`, locale })}`,
    });
  } catch (error) {
    console.error("[handle] change notification failed:", error);
  }
}

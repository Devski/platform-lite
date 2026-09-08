import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { getDb } from "@/db/client";
import { getStorage, keyPrefix } from "@/lib/storage";
import { workInputSchema } from "@/lib/work-schemas";
import { deleteWork, updateWork } from "@/lib/works";
import { respondWithWorkResult } from "../respond";

// #72 / A12: replace a work's fields and photos, or delete it. Both act only
// on the caller's own work (lib/works answers not_found otherwise).

type Context = { params: Promise<{ id: string }> };

async function guard(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return {
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return { response: crossSite };
  if (!checkRateLimit(`works:${userId}`, { windowSeconds: 60, max: 30 })) {
    return {
      response: NextResponse.json({ error: "rate_limited" }, { status: 429 }),
    };
  }
  return { userId };
}

function workId(raw: string): string | null {
  return z.uuid().safeParse(raw).success ? raw : null;
}

export async function PATCH(request: Request, { params }: Context) {
  const guarded = await guard(request);
  if ("response" in guarded) return guarded.response;
  const id = workId((await params).id);
  const input = await parseJsonBody(request, workInputSchema);
  if (!id || !input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  return respondWithWorkResult(() =>
    updateWork(
      {
        db: getDb(),
        storage: getStorage(),
        prefix: keyPrefix(),
        userId: guarded.userId,
      },
      id,
      input,
    ),
  );
}

export async function DELETE(request: Request, { params }: Context) {
  const guarded = await guard(request);
  if ("response" in guarded) return guarded.response;
  const id = workId((await params).id);
  if (!id) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  return respondWithWorkResult(() =>
    deleteWork(
      {
        db: getDb(),
        storage: getStorage(),
        prefix: keyPrefix(),
        userId: guarded.userId,
      },
      id,
    ),
  );
}

import { NextResponse } from "next/server";
import { checkRateLimit, sessionUserId } from "@/lib/api-route";
import { getDb } from "@/db/client";
import { listUnattachedArchives } from "@/lib/r360/archive-resume";

// #105 / A13: the archives of the caller that reached the bucket and no
// work names — what the form offers to finish from.

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (
    !checkRateLimit(`archive-list:${userId}`, { windowSeconds: 60, max: 30 })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const archives = await listUnattachedArchives({ db: getDb(), userId });
  return NextResponse.json({
    archives: archives.map((archive) => ({
      fileId: archive.fileId,
      sizeBytes: archive.sizeBytes,
      createdAt: archive.createdAt.toISOString(),
    })),
  });
}

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AvatarUploadError, confirmAvatarUpload } from "@/lib/avatar";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { getStorage, keyPrefix } from "@/lib/storage";

// Step two of the #12 avatar flow: verify the staged bytes server-side and
// publish original + WebP variants under content-addressed keys. Rejections
// come back as stable codes; the #14 UI maps them to pl/en copy.

const confirmSchema = z.object({ stagingKey: z.string().min(1) });

export async function POST(request: Request) {
  let userId: string | null = null;
  try {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    });
    userId = session?.user.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await confirmAvatarUpload(
      { storage: getStorage(), db: getDb(), prefix: keyPrefix(), userId },
      parsed.data,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AvatarUploadError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }
}

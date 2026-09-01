import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { presignAvatarSchema, presignAvatarUpload } from "@/lib/avatar";
import { getAuth } from "@/lib/auth";
import { getStorage, keyPrefix } from "@/lib/storage";

// Step one of the #12 avatar flow: authenticate, validate the A4 edge, hand
// back a short-lived staging upload URL. Thin by design — the logic lives in
// lib/avatar.ts, tested against the memory fake.

export async function POST(request: Request) {
  // Fail closed like the (app) layout: an unverifiable session — including
  // an environment with no database — is a 401, never a 500.
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
  const parsed = presignAvatarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await presignAvatarUpload(
    { storage: getStorage(), prefix: keyPrefix(), userId },
    parsed.data,
  );
  return NextResponse.json(result);
}

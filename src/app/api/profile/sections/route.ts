import { NextResponse } from "next/server";
import {
  checkRateLimit,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "@/lib/api-route";
import { getDb } from "@/db/client";
import { profileSectionsSchema } from "@/lib/profile-schemas";
import { ProfileError, updateProfileSections } from "@/lib/profile";

// #72: the headline, the places and the bio — any subset per call, since the
// owner's page saves each field when it is left. Thin, as /api/profile is:
// the validation is the shared schema and the logic lives in lib/profile.

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  // Its own budget, wider than the name's: every chip added or removed is
  // one call, and a first edit pass can be a dozen of them in a minute.
  if (
    !checkRateLimit(`profile-sections:${userId}`, {
      windowSeconds: 60,
      max: 40,
    })
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const input = await parseJsonBody(request, profileSectionsSchema);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    await updateProfileSections({ db: getDb(), userId }, input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // A section before onboarding: the row does not exist yet, and a photo
    // gets the same answer (/api/profile/avatar).
    if (error instanceof ProfileError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }
}

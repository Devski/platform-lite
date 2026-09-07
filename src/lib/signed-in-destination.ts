import { headers } from "next/headers";
import { getDb } from "@/db/client";
import { getAuth } from "@/lib/auth";
import { getHandleState } from "@/lib/profile-handle";

// Shared by the hero (screen 1) and the 404 page (screen 3): both are
// unreachable once signed in — the design routes a signed-in visitor to
// their own public profile instead, or to onboarding if they haven't set a
// handle yet. A session that cannot be verified (including a preview
// environment with no database at all) counts as signed out, the same
// fail-closed rule the (app) layout uses, so both pages keep rendering for
// the DB-less e2e job. The whole body is one try/catch — not just the
// session read — because getHandleState is a second, independent database
// round trip that can fail on its own even once a session is confirmed.
export async function signedInDestination(): Promise<string | null> {
  try {
    const session = await getAuth().api.getSession({ headers: await headers() });
    const userId = session?.user.id ?? null;
    if (!userId) return null;
    const { handle } = await getHandleState(getDb(), userId);
    return handle ? `/${handle}` : "/onboarding";
  } catch {
    return null;
  }
}

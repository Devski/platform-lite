import { ImageResponse } from "next/og";
import { getDb } from "@/db/client";
import { isMissingEnv } from "@/lib/env";
import {
  initialsFrom,
  MONOGRAM_BACKGROUND,
  MONOGRAM_CARD,
  MONOGRAM_FOREGROUND,
} from "@/lib/monogram";
import { loadPublicProfile } from "@/lib/public-profile";
import { getStorage, keyPrefix } from "@/lib/storage";

// The share image for a profile with no photo (#27): exactly what the page
// draws in its place, at exactly the size a photo would occupy. Two different
// placeholders — a grey disc on the page, a blue "platform-lite" box in the
// preview — looked like two different products; and the wide card that first
// replaced the box was illegible in the small tile a chat client actually
// draws. Both problems have one fix: draw the page's monogram, square.
//
// Under /api because handle.ts already reserves that word; a top-level /og
// would need a new reserved handle, and reserving one after handles exist is
// a migration, not a config line.

export const dynamic = "force-dynamic";

// A day. The image changes only when the display name does, and a stale one
// is a wrong monogram for a while — not a wrong page.
const CACHE_CONTROL = "public, max-age=86400, s-maxage=86400";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;

  let displayName: string;
  try {
    const result = await loadPublicProfile(
      {
        db: getDb(),
        // Never read here — this image exists precisely because there is no
        // avatar — but the reader wants the dependency, and a lazy one keeps
        // the route working with no bucket configured.
        storage: { publicUrl: (key) => getStorage().publicUrl(key) },
        prefix: keyPrefix(),
      },
      handle,
    );
    if (result.kind !== "profile") {
      return new Response("Not found", { status: 404 });
    }
    displayName = result.profile.displayName;
  } catch (error) {
    // Same contract as the public page: a missing DATABASE_URL is "not
    // configured here", never "no such profile" (#18 review).
    if (!isMissingEnv(error, "DATABASE_URL")) throw error;
    return new Response("Not configured", { status: 404 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: MONOGRAM_BACKGROUND,
          color: MONOGRAM_FOREGROUND,
          fontSize: 236,
          fontWeight: 600,
          fontFamily: "sans-serif",
        }}
      >
        {initialsFrom(displayName)}
      </div>
    ),
    { ...MONOGRAM_CARD, headers: { "Cache-Control": CACHE_CONTROL } },
  );
}

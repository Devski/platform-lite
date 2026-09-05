import { ImageResponse } from "next/og";
import { getDb } from "@/db/client";
import { appOrigin, isMissingEnv } from "@/lib/env";
import {
  initialsFrom,
  MONOGRAM_BACKGROUND,
  MONOGRAM_CARD,
  MONOGRAM_FOREGROUND,
} from "@/lib/monogram";
import { loadPublicProfile } from "@/lib/public-profile";
import { getStorage, keyPrefix } from "@/lib/storage";

// The share card for a profile with no photo (#27). Generated per profile
// rather than served as one static file, so the card carries the person's
// initials and address instead of the product's name — a preview that says
// only "platform-lite" tells the reader nothing about the link they were
// sent, and looked like a different product from the page it opens.
//
// Under /api because handle.ts already reserves that word; a top-level /og
// would need a new reserved handle, and reserving one after handles exist is
// a migration, not a config line.

export const dynamic = "force-dynamic";

// A day. The card changes only when the display name does, and a stale one is
// a wrong monogram for a while — not a wrong page.
const CACHE_CONTROL = "public, max-age=86400, s-maxage=86400";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;

  let displayName = "";
  let address = "";
  try {
    const result = await loadPublicProfile(
      {
        db: getDb(),
        // Never read here — the card exists precisely because there is no
        // avatar — but the reader wants the dependency, and a lazy one
        // keeps this route working with no bucket configured.
        storage: { publicUrl: (key) => getStorage().publicUrl(key) },
        prefix: keyPrefix(),
      },
      handle,
    );
    if (result.kind !== "profile") {
      return new Response("Not found", { status: 404 });
    }
    displayName = result.profile.displayName;
    address = `${appOrigin().replace(/^https?:\/\//, "")}/${result.profile.handle}`;
  } catch (error) {
    // Same contract as the public page: a missing DATABASE_URL is "not
    // configured here", never "no such profile" (#18 review).
    if (isMissingEnv(error, "DATABASE_URL") || isMissingEnv(error, "APP_URL")) {
      return new Response("Not configured", { status: 404 });
    }
    throw error;
  }

  const initials = initialsFrom(displayName);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 96px",
          background: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: 300,
            height: 300,
            flexShrink: 0,
            borderRadius: "50%",
            background: MONOGRAM_BACKGROUND,
            color: MONOGRAM_FOREGROUND,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 132,
            fontWeight: 600,
          }}
        >
          {initials}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 68, fontWeight: 700, color: "#1c1917" }}>
            {displayName}
          </div>
          <div style={{ fontSize: 34, color: "#78716c" }}>{address}</div>
        </div>
      </div>
    ),
    {
      ...MONOGRAM_CARD,
      headers: { "Cache-Control": CACHE_CONTROL },
    },
  );
}

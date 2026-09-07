import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The A3D mark drawn for `next/og`: the same square the top bar renders in
// the browser (Mark in src/components/ui/mark.tsx), redrawn here because
// satori understands inline styles, not Tailwind classes. Three route files
// use it — the tab icon, the iOS home-screen icon and the share card — so
// the proportions live in one place and cannot drift apart between them.
//
// Every ratio below is the component's, so the two stay the same mark:
// change one and change the other.

// Straight from globals.css (--color-plaque-navy / --color-plaque-red).
// Literal because satori never sees the stylesheet.
const NAVY = "#0f4eb1";
const RED = "#c9150f";

// The band is 12% of the height and the wordmark 34% of it (Mark). The
// corner is --radius-xs, 4px on the component's own 30px square — kept as
// that ratio rather than the 4px, because these images are drawn at four
// sizes and a fixed 4px would read as a sharp corner at 128px.
const BAND_RATIO = 0.12;
const TYPE_RATIO = 0.34;
const RADIUS_RATIO = 4 / 30;

// Figtree Bold, the interface font (globals.css --font-sans). Committed
// rather than fetched from a CDN at render time: a tab icon that silently
// loses its typeface because fonts.gstatic.com was slow is worse than one
// that fails to build.
//
// It lives in public/ and is read from disk, not imported: the bundler has
// no loader for a .ttf, and `fetch(new URL(..., import.meta.url))` — the
// pattern Next's own docs show — is unimplemented in this runtime. The
// Dockerfile copies public/ next to server.js, so the path holds in the
// container as well as in dev. Read once per process, not per request.
let fontBytes: Promise<Buffer> | undefined;

export async function brandFont() {
  fontBytes ??= readFile(join(process.cwd(), "public", "figtree-bold.ttf"));
  return [
    {
      name: "Figtree",
      data: await fontBytes,
      weight: 700 as const,
      style: "normal" as const,
    },
  ];
}

export function BrandMark({ size }: { size: number }) {
  const band = size * BAND_RATIO;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        borderRadius: size * RADIUS_RATIO,
        background: NAVY,
        color: "#ffffff",
        fontSize: size * TYPE_RATIO,
        fontWeight: 700,
        fontFamily: "Figtree",
        // Half the band, exactly as the component does it: the wordmark is
        // centred on the whole square, not on the navy field above the band.
        paddingBottom: band / 2,
      }}
    >
      {"A3D"}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: band,
          background: RED,
        }}
      />
    </div>
  );
}

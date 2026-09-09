import type { ReactNode } from "react";

// Small hand-authored icon set matching the design-system-source note ("all
// icons are Lucide, 1.75 stroke") without pulling in the lucide package for
// the two icons this design actually uses — not a general icon library.
type IconName =
  | "map-pin-off"
  | "log-out"
  | "smartphone"
  | "pencil"
  | "user"
  | "settings"
  | "folder-open"
  | "camera"
  | "check"
  | "mail"
  | "menu"
  | "map-pin"
  | "x"
  | "plus"
  | "chevron-left"
  | "chevron-right"
  | "upload"
  | "layers";

const PATHS: Record<IconName, ReactNode> = {
  "map-pin-off": (
    <>
      <path d="M12 21s7-7.6 7-12a7 7 0 0 0-1.55-4.4" />
      <path d="M9.17 4.66A7 7 0 0 0 5 10c0 3.2 3.2 7.2 5.2 9.4" />
      <circle cx="12" cy="10" r="2.25" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </>
  ),
  "log-out": (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  smartphone: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <line x1="11" y1="18.5" x2="13" y2="18.5" />
    </>
  ),
  pencil: (
    <>
      <path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 3 21.5l1-4.5Z" />
      <path d="M15 5l4 4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.1A1.7 1.7 0 0 0 10.14 3H10a2 2 0 0 1 4 0v.09c0 .67.4 1.27 1.04 1.56.63.27 1.36.14 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.48.51-.61 1.24-.34 1.87v.09c.28.64.88 1.04 1.56 1.04H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04Z" />
    </>
  ),
  "folder-open": (
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H7a2 2 0 0 0-1.94 1.5L3 18Z M3 7v11a2 2 0 0 0 2 2h13a2 2 0 0 0 1.94-1.5L22 11H7a2 2 0 0 0-1.94 1.5" />
  ),
  camera: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h1l1.5-2h7L17 6h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  check: <polyline points="4 12 9 17 20 6" />,
  mail: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="m3 6.5 9 6.5 9-6.5" />
    </>
  ),
  // Lucide's own "menu" — the hamburger that stands in for the top bar's
  // action row below sm (see mobile-menu.tsx).
  menu: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </>
  ),
  // #72: the places a profile names (map-pin-off above is the 404's).
  "map-pin": (
    <>
      <path d="M12 21s7-7.6 7-12a7 7 0 1 0-14 0c0 4.4 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  // #72: remove a place chip; close.
  x: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  // #72: add a work.
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  // #72: step through a work's photos in the overlay.
  "chevron-left": <polyline points="15 5 8 12 15 19" />,
  "chevron-right": <polyline points="9 5 16 12 9 19" />,
  // #99: a photo's second channel.
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  // #72: the R360 archive slot.
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 20h16" />
    </>
  ),
};

export function Icon({
  name,
  size = 24,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

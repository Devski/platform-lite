// The stand-in for a profile with no photo (#27), in ONE place because it has
// to appear in two: the circle on the public page, and the 1200×630 card a
// chat client shows when the link is shared. Those were two different
// placeholders — a grey disc on the page, a blue "platform-lite" box in the
// preview — and looked like two different products. Seen on WhatsApp
// 05.09.2026.

/**
 * The stone palette the placeholder uses. Deliberately one colour for
 * everyone rather than a hue derived from the handle: the audience is
 * architecture studios, and a wall of randomly tinted discs reads as playful
 * where this should read as restrained (decision of 05.09.2026).
 */
export const MONOGRAM_BACKGROUND = "#e7e5e4";
export const MONOGRAM_FOREGROUND = "#57534e";

/**
 * Up to two initials for the card and the circle. Splits on the separators a
 * display name actually contains — spaces, hyphens, dots, underscores — so
 * "Anna Kowalska-Nowak" gives AK and "studio.praga" gives SP.
 *
 * Returns "" when there is nothing to take an initial from; the caller draws
 * the plain disc then, which is what a name of punctuation alone deserves.
 * Diacritics are KEPT: the card renders them correctly (verified against the
 * generator's default font), and "Żaneta" shown as Z would be a small insult
 * repeated on every share.
 */
export function initialsFrom(displayName: string): string {
  return displayName
    .split(/[\s._+-]+/)
    .filter((part) => part.length > 0)
    // A leading digit or symbol is not an initial anyone recognises.
    .map((part) => [...part].find((ch) => /\p{L}/u.test(ch)))
    .filter((ch): ch is string => ch !== undefined)
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("pl-PL");
}

/** Where the generated share card for a handle lives. */
export function monogramImagePath(handle: string): string {
  // Under /api, which handle.ts already reserves — a top-level /og would need
  // a new reserved word, and reserving one after handles exist is a migration.
  return `/api/og/${encodeURIComponent(handle)}`;
}

/**
 * Square, and the same 512 px the avatar variant is (#12) — NOT the 1200×630
 * the Open Graph guides recommend. A wide card is legible on its own and
 * illegible in the small tile a chat client actually draws: next to a photo
 * profile rendered large, the monogram shrank to a smudge. Seen on WhatsApp
 * 05.09.2026. Matching the photo's shape is what makes both render the same.
 */
export const MONOGRAM_CARD = { width: 512, height: 512 } as const;

import { z } from "zod";

// The handle rules (A5, A6) — pure and client-safe, so the picker form
// validates with the same schema the server enforces (§5). The database side
// of a handle (availability, suggestion, claiming) lives in profile-handle.ts.

// A5: 3–30 characters, lowercase letters, digits and hyphens, a letter or
// digit at both ends. Handles are stored pre-normalized (the CHECK in
// schema.ts refuses anything not lowercase), so the edge normalizes first.
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;
export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

// A5: names a profile may never take. Three families, one list: every
// top-level route segment (a profile at /login would be unreachable — the
// static route wins), the locale prefixes, and words that would read as an
// official or system address. handle.test.ts checks that every segment under
// src/app/[locale] is on this list, so a new page cannot be shadowed.
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  // Locale prefixes (A8) — today's and the likely next ones.
  "pl",
  "en",
  "de",
  "fr",
  "es",
  "it",
  "cs",
  "sk",
  "uk",
  "ua",
  "ru",
  "nl",
  "pt",
  "sv",
  "no",
  "da",
  "fi",
  // Route segments, present and foreseeable.
  "api",
  "auth",
  "login",
  "logout",
  "register",
  "signup",
  "signin",
  "sign-up",
  "sign-in",
  "settings",
  "account",
  "accounts",
  "profile",
  "profiles",
  "onboarding",
  "verify",
  "verified",
  "reset-password",
  "reset",
  "password",
  "two-factor",
  "2fa",
  "email-changed",
  "email",
  "assets",
  "static",
  "public",
  "images",
  "img",
  "files",
  "uploads",
  "media",
  "cdn",
  "robots",
  "sitemap",
  "favicon",
  "manifest",
  // Next's metadata file conventions resolve as top-level routes too.
  "icon",
  "apple-icon",
  "opengraph-image",
  "twitter-image",
  "health",
  "status",
  "metrics",
  "search",
  "explore",
  "dashboard",
  "home",
  "index",
  "new",
  "edit",
  "delete",
  "me",
  "you",
  "user",
  "users",
  "app",
  "apps",
  "dev",
  "test",
  "staging",
  "demo",
  "docs",
  "blog",
  "news",
  "help",
  "support",
  "contact",
  "about",
  "terms",
  "privacy",
  "legal",
  "cookies",
  // System and official-looking names.
  "admin",
  "administrator",
  "root",
  "system",
  "sys",
  "moderator",
  "mod",
  "staff",
  "team",
  "official",
  "security",
  "abuse",
  "postmaster",
  "hostmaster",
  "webmaster",
  "noreply",
  "no-reply",
  "info",
  "hello",
  "www",
  "mail",
  "ftp",
  "smtp",
  "imap",
  "localhost",
  "null",
  "undefined",
  "true",
  "false",
  // The product and the company (§12 naming decision of 30.08.2026).
  "architektow3d",
  "architektow-3d",
  "architectorium",
  "architektorium",
  "platform",
  "platform-lite",
]);

// Impersonating the platform itself: a handle carrying the product or the
// company name is refused as a whole ("architektow3d-support"), not only as
// the exact word. The profession ("architekt") stays free.
export const RESERVED_BRAND_TOKENS: readonly string[] = [
  "architektow3d",
  "architektow-3d",
  "architectorium",
  "architektorium",
];

// Official-looking addresses: "admin-jan" reads as staff even though the bare
// word is already reserved. Only the exact prefix with its hyphen is refused
// ("administracja-x", "jan-admin", "supporter" stay free), and each stem is on
// RESERVED_HANDLES in its own right, so the two lists cannot disagree.
export const RESERVED_HANDLE_PREFIXES: readonly string[] = [
  "admin-",
  "official-",
  "support-",
];

export type HandleProblem = "invalid" | "reserved";

/** Trim and lowercase — what the form submits is exactly what gets stored. */
export function normalizeHandle(input: string): string {
  return input.trim().toLowerCase();
}

/** A5 verdict on an already-normalized handle; null when it is fine. */
export function checkHandle(handle: string): HandleProblem | null {
  if (!HANDLE_PATTERN.test(handle)) return "invalid";
  if (RESERVED_HANDLES.has(handle)) return "reserved";
  if (RESERVED_BRAND_TOKENS.some((token) => handle.includes(token))) {
    return "reserved";
  }
  if (RESERVED_HANDLE_PREFIXES.some((prefix) => handle.startsWith(prefix))) {
    return "reserved";
  }
  return null;
}

// The issue message IS the problem code ("invalid" | "reserved"), so the form
// and the routes map it to copy without parsing prose.
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    const problem = checkHandle(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

// A6: a change no more than once per 30 days. The initial assignment is not
// a change — handle_changed_at stays NULL until the first real change.
export const HANDLE_CHANGE_COOLDOWN_DAYS = 30;
const HANDLE_CHANGE_COOLDOWN_MS =
  HANDLE_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/** When the next change is allowed; null means right away. */
export function nextHandleChangeAt(
  changedAt: Date | null,
  now: Date = new Date(),
): Date | null {
  if (!changedAt) return null;
  const allowedAt = new Date(changedAt.getTime() + HANDLE_CHANGE_COOLDOWN_MS);
  return allowedAt > now ? allowedAt : null;
}

// Letters that NFD decomposition leaves alone (no combining mark to strip).
const BARE_LETTERS: Record<string, string> = {
  ł: "l",
  ø: "o",
  đ: "d",
  ß: "ss",
  æ: "ae",
  œ: "oe",
};
const BARE_LETTER = new RegExp(`[${Object.keys(BARE_LETTERS).join("")}]`, "g");

/**
 * A handle candidate derived from free text (a display name, an e-mail's
 * local part): diacritics stripped ("Pracownia Żółć" → "pracownia-zolc"),
 * everything else collapsed to single hyphens, cut to the A5 length. Null
 * when nothing usable remains (too short, or a reserved word) — the caller
 * falls back to a generic base.
 */
export function handleBaseFrom(text: string): string | null {
  const ascii = text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(BARE_LETTER, (letter) => BARE_LETTERS[letter])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const cut = ascii.slice(0, HANDLE_MAX).replace(/-+$/, "");
  if (cut.length < HANDLE_MIN || checkHandle(cut) !== null) return null;
  return cut;
}

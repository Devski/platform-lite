import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { normalizeHandle } from "@/lib/handle";
import { getProfile, type ProfileReadDeps } from "@/lib/profile";
import { resolveHandle } from "@/lib/profile-handle";

// The public face of a profile (#18): what /[handle] renders for an
// anonymous visitor and what its <head> says. Read-only composition — the
// §9 resolution is resolveHandle's, the view getProfile's — that keeps every
// internal detail (file ids) off the object the page gets.

export interface PublicProfile {
  userId: string;
  /** The canonical, stored handle. */
  handle: string;
  /** profiles.display_name — a live handle always has a row (setHandle seeds it). */
  displayName: string;
  avatar: { url512: string; url128: string } | null;
}

export type PublicProfileLookup =
  | {
      kind: "profile";
      profile: PublicProfile;
      /** False when the input differed from the stored handle (case, whitespace). */
      canonical: boolean;
    }
  /** The target's CURRENT handle — where the old address should go. */
  | { kind: "redirect"; handle: string }
  | { kind: "notFound" };

// Exactly what the read below needs — getProfile's dependencies, minus the
// user it is about to look up. Storage is the URL half only and touched only
// when an avatar exists, so the page hands in a lazy publicUrl and renders
// without a configured bucket (the settings page does the same).
export type PublicProfileDeps = Omit<ProfileReadDeps, "userId">;

/**
 * §9 for the public page: profile → redirect → notFound on the normalized
 * input. A profile hit is reported with whether the input already WAS the
 * stored handle, so the page can send a case variant to the one canonical
 * URL. A missing DATABASE_URL is the caller's concern (the page maps it to
 * notFound); every other failure propagates — an outage must not read as
 * "no such profile".
 */
export async function loadPublicProfile(
  deps: PublicProfileDeps,
  input: string,
): Promise<PublicProfileLookup> {
  const handle = normalizeHandle(input);
  const resolution = await resolveHandle(deps.db, handle);
  if (resolution.kind !== "profile") return resolution;

  const view = await getProfile({ ...deps, userId: resolution.userId });
  // display_name is NOT NULL, so a null here means the row is gone: the
  // account was deleted (cascade) between the two reads. A profile that no
  // longer exists is a 404, not an error.
  if (view.displayName === null) return { kind: "notFound" };

  return {
    kind: "profile",
    canonical: input === handle,
    profile: {
      userId: resolution.userId,
      // Handles are stored pre-normalized (the CHECK in schema.ts) and the
      // lookup is equality, so the normalized input IS the stored value.
      handle,
      displayName: view.displayName,
      avatar: view.avatar
        ? { url512: view.avatar.url512, url128: view.avatar.url128 }
        : null,
    },
  };
}

// og:locale per routing locale. Typed against Locale on purpose: a language
// added to routing.ts fails here until it gets its territory code.
const OG_LOCALES: Record<Locale, string> = { pl: "pl_PL", en: "en_US" };

// The two share-image shapes: the #12 512 px avatar variant, and the
// committed public/og-placeholder.png (1200×630, the Open Graph
// recommendation) that stands in when there is none — #27 decides the art.
const AVATAR_IMAGE = { width: 512, height: 512 };
const PLACEHOLDER_IMAGE = { width: 1200, height: 630 };

export interface ProfileMetadataInput {
  profile: PublicProfile;
  /** appOrigin() — the absolute prefix of every URL in the head. */
  origin: string;
  locale: Locale;
  /** Metadata.title from the dictionary. */
  brand: string;
  /** Already translated, e.g. "Profil {name} na {brand}". */
  description: string;
  /** Already translated alt text for the avatar share image. */
  avatarAlt: string;
  /** Absolute URL of the placeholder share image. */
  placeholderImage: string;
  /**
   * The locale-aware path of a handle (`/x`, `/en/x`). Injected rather than
   * imported: next-intl's getPathname needs the request config, which only a
   * page render has — the page passes it, the unit test the A8 rule by hand.
   */
  pathFor: (handle: string, locale: Locale) => string;
}

/**
 * The <head> of a public profile: `<title>`, description, the canonical
 * URL in the requested locale with an hreflang entry for every routing
 * locale, an Open Graph profile card (image = the 512 px avatar, else the
 * placeholder) and a Twitter summary card, which falls back to the OG tags.
 */
export function profileMetadata(input: ProfileMetadataInput): Metadata {
  const {
    profile,
    origin,
    locale,
    brand,
    description,
    placeholderImage,
    pathFor,
  } = input;
  const title = `${profile.displayName} · ${brand}`;
  const urlIn = (target: Locale) =>
    `${origin}${pathFor(profile.handle, target)}`;
  const canonical = urlIn(locale);
  const languages = Object.fromEntries(
    routing.locales.map((target) => [target, urlIn(target)]),
  );
  // Alt text on the share card too: a screen reader in a chat client reads
  // the card, not the page.
  const image = profile.avatar
    ? { url: profile.avatar.url512, alt: input.avatarAlt, ...AVATAR_IMAGE }
    : { url: placeholderImage, alt: brand, ...PLACEHOLDER_IMAGE };

  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      type: "profile",
      username: profile.handle,
      title,
      description,
      url: canonical,
      siteName: brand,
      locale: OG_LOCALES[locale],
      images: [image],
    },
    twitter: { card: "summary" },
  };
}

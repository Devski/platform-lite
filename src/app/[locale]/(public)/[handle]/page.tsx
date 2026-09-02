import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { appOrigin, isMissingEnv } from "@/lib/env";
import {
  loadPublicProfile,
  profileMetadata,
  type PublicProfileLookup,
} from "@/lib/public-profile";
import { getStorage, keyPrefix } from "@/lib/storage";

// A7: the public profile — the one page an anonymous visitor (and a crawler)
// sees. The §9 resolution and the <head> live in src/lib/public-profile.ts;
// this file is the request side of it: locale, one lookup, the three answers
// (render, 308, 404) and a card with nothing on it but the photo, the name
// and the address (§1 — no cover, no tabs, no about).

// Every render reads the database, so the page is never prerendered — the
// (app) layout takes the same way out for its session reads.
export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; handle: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

// The committed 1200×630 share image for a profile without an avatar
// (public/og-placeholder.png); #27 decides the final art.
const OG_PLACEHOLDER_PATH = "/og-placeholder.png";

// One §9 lookup per request: generateMetadata and the render ask for the same
// handle, and React's cache() answers the second one from the first.
const lookup = cache(async (handle: string): Promise<PublicProfileLookup> => {
  try {
    return await loadPublicProfile(
      {
        db: getDb(),
        // Resolved on first use, as the settings page does: the bucket is
        // needed only to address an existing avatar, so a profile without one
        // renders with no S3_* configured at all.
        storage: { publicUrl: (key) => getStorage().publicUrl(key) },
        prefix: keyPrefix(),
      },
      handle,
    );
  } catch (error) {
    // No DATABASE_URL at all (the DB-less e2e job, a preview without a
    // database) is the one failure that may read as "no such profile" — the
    // same branch src/proxy.ts takes. Named on purpose: a missing S3_* comes
    // through the same lazy publicUrl and is an outage, not a free handle
    // (#18 review). Everything else must surface as a 500 too.
    if (!isMissingEnv(error, "DATABASE_URL")) throw error;
    return { kind: "notFound" };
  }
});

// "?a=1&b=2" for a request that had a query, "" for one that had none.
function queryOf(
  search: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    for (const one of Array.isArray(value) ? value : [value ?? ""]) {
      if (value !== undefined) params.append(key, one);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

// The middleware routes only the A8 locales here and the layout 404s on
// anything else; this narrows the raw param for the metadata helper.
function localeOf(value: string): Locale {
  if (!hasLocale(routing.locales, value)) notFound();
  return value;
}

// Where a handle lives: `/studio-x` in Polish, `/en/studio-x` in English
// (A8's as-needed prefix). Every canonical URL and both redirects go through
// it, and profileMetadata takes it as an argument because next-intl can only
// answer inside a request — which a unit test has not.
const handlePath = (handle: string, locale: Locale) =>
  getPathname({ href: `/${handle}`, locale });

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale: requested, handle } = await params;
  const locale = localeOf(requested);
  const result = await lookup(handle);
  if (result.kind !== "profile") {
    // A redirect never shows its <head>, and a miss renders not-found.tsx.
    const t = await getTranslations({ locale, namespace: "NotFound" });
    return { title: t("title") };
  }

  const tMeta = await getTranslations({ locale, namespace: "Metadata" });
  const t = await getTranslations({ locale, namespace: "PublicProfile" });
  const brand = tMeta("title");
  const origin = appOrigin();
  return profileMetadata({
    profile: result.profile,
    origin,
    locale,
    brand,
    description: t("description", { name: result.profile.displayName, brand }),
    avatarAlt: t("avatarAlt", { name: result.profile.displayName }),
    placeholderImage: `${origin}${OG_PLACEHOLDER_PATH}`,
    pathFor: handlePath,
  });
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { locale: requested, handle } = await params;
  const locale = localeOf(requested);
  setRequestLocale(locale);
  const result = await lookup(handle);

  if (result.kind === "notFound") notFound();
  // Both redirects below keep the query, as the proxy's 301 does: a shared
  // link carries its campaign parameters to the address that answers.
  const query = queryOf(await searchParams);
  // A6/§9: an old address is the proxy's 301. The page sees one only when
  // that lookup failed open or timed out — a 308 from here is the degraded
  // answer, and still the right destination.
  if (result.kind === "redirect") {
    permanentRedirect(`${handlePath(result.handle, locale)}${query}`);
  }

  const { profile } = result;
  // One profile, one URL. The proxy leaves /Studio-Praga alone (the A5
  // pattern is lowercase), so the case variant settles here.
  if (!result.canonical) {
    permanentRedirect(`${handlePath(profile.handle, locale)}${query}`);
  }

  const t = await getTranslations("PublicProfile");
  const address = `${appOrigin()}/${profile.handle}`;

  return (
    <main className="flex min-h-screen justify-center bg-gray-50 px-4 py-12">
      <article className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-gray-200 bg-white p-8 text-center">
        {profile.avatar ? (
          // Pre-optimized WebP served from storage (G2/G5) — next/image would
          // only re-proxy an already-final asset from a runtime-configured
          // host, as the settings page notes.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar.url128}
            alt={t("avatarAlt", { name: profile.displayName })}
            width={128}
            height={128}
            className="h-32 w-32 rounded-full border border-gray-200 object-cover"
          />
        ) : (
          // Decorative: the name below already says whose profile this is.
          <div
            aria-hidden="true"
            className="h-32 w-32 rounded-full border border-gray-200 bg-gray-100"
          />
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {profile.displayName}
        </h1>
        {/* The address is the profile's identity (A5) — shown, not linked:
            the visitor is already on it. */}
        <p className="text-sm text-gray-600">
          <span className="sr-only">{t("addressLabel")}</span>
          <span className="font-mono">{address}</span>
        </p>
      </article>
    </main>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getAuth } from "@/lib/auth";
import { appOrigin, isMissingEnv } from "@/lib/env";
import { monogramImagePath } from "@/lib/monogram";
import {
  loadPublicProfile,
  profileMetadata,
  type PublicProfileLookup,
} from "@/lib/public-profile";
import { getStorage, keyPrefix } from "@/lib/storage";
import { listWorks } from "@/lib/works";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { LanguageChip } from "@/components/ui/language-chip";
import { Logo } from "@/components/ui/logo";
import { MobileMenu } from "@/components/ui/mobile-menu";
import { Plaque } from "@/components/ui/plaque";
import { TopBar } from "@/components/ui/top-bar";
import { OwnerProfileView } from "./owner-profile-view";
import { WorksGallery } from "./works-gallery";
import {
  BioView,
  CARD_BODY_CLASS,
  CoverView,
  HeadlineView,
  LocationsView,
} from "./profile-sections";

// Whether the CURRENT viewer owns this profile (screen 6 vs screen 2). Fails
// closed like every other session read here: a session that cannot be
// verified (including a preview environment with no database at all) is
// treated as "not the owner", never the other way round.
async function isOwnerViewing(userId: string): Promise<boolean> {
  try {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    });
    return session?.user.id === userId;
  } catch {
    return false;
  }
}

// A7: the public profile — the one page an anonymous visitor (and a crawler)
// sees. The §9 resolution and the <head> live in src/lib/public-profile.ts;
// this file is the request side of it: locale, one lookup, the three answers
// (render, 308, 404) and the card: the photo, the name and the address, and
// since #72 the A12 sections a profile has filled in (§1 — still no tabs).

// Every render reads the database, so the page is never prerendered — the
// (app) layout takes the same way out for its session reads.
export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; handle: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

// The committed 1200×630 share image for a profile without an avatar
// (public/og-placeholder.png); #27 decides the final art.
// The share card is generated per profile (#27) — see the /api/og route.

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
    // A7: the headline is the profile's own one-line description once it
    // has one; the generic sentence stands in until then.
    description:
      result.profile.headline ??
      t("description", { name: result.profile.displayName, brand }),
    avatarAlt: t("avatarAlt", { name: result.profile.displayName }),
    placeholderImage: `${origin}${monogramImagePath(result.profile.handle)}`,
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

  if (await isOwnerViewing(profile.userId)) {
    return (
      <>
        <OwnerProfileView
          profile={profile}
          works={await listWorks({
            db: getDb(),
            storage: { publicUrl: (key) => getStorage().publicUrl(key) },
            prefix: keyPrefix(),
            userId: profile.userId,
          })}
        />
        <Footer maxWidth="measure-page" />
      </>
    );
  }

  const t = await getTranslations("PublicProfile");
  const tSession = await getTranslations("Session");
  const tWorks = await getTranslations("Works");

  // The bar's actions, rendered twice by TopBar: as the row from sm up, and
  // inside the hamburger's panel below it. A 360px screen leaves the bar
  // 328px between its gutters, and this bar wants 393 of them — logo 160,
  // the bar's own 12px gap, then the language chip (101) + 12 + "Załóż
  // konto" (108). The left box is min-w-0, so the overflow showed up as the
  // wordmark printed over the language chip rather than as a wider bar. The
  // panel is a card surface and so is this bar, so both copies are the very
  // same on-card elements (unlike the hero's, which has to flip tone).
  const actions = (
    <>
      <LanguageChip locale={locale} />
      <ButtonLink variant="quiet" href="/register">
        {tSession("register")}
      </ButtonLink>
    </>
  );

  return (
    <>
      {/* This screen is the signed-out visitor's view of someone else's
          profile (README screen 2) — the mark goes to the hero, not to a
          session-dependent destination. The owner sees OwnerProfileView
          instead (screen 6), above. */}
      <TopBar
        maxWidth="measure-page"
        left={<Logo href="/" />}
        right={actions}
        mobileMenu={<MobileMenu>{actions}</MobileMenu>}
      />
      <main className="mx-auto flex max-w-(--measure-page) flex-col gap-(--sp-5) px-(--sp-5) pt-(--sp-8) pb-(--sp-10) sm:gap-(--sp-6) sm:px-(--sp-7) sm:pt-(--sp-12) sm:pb-(--sp-14)">
        <Card as="article" padding="none">
          {profile.cover && (
            <div className="overflow-hidden rounded-t-md">
              <CoverView cover={profile.cover} name={profile.displayName} />
            </div>
          )}
          <div className={CARD_BODY_CLASS}>
            {/* Stacked below sm. A 128px avatar plus a display-size name has
              no way to share the 248px a 360px phone leaves inside this
              card, and the name was the half that ran off the right edge;
              given the full width instead it wraps like text. The size
              itself needs no breakpoint — --fs-display is a clamp() that has
              already stepped 48px down to 32px by the time a phone reads
              it. From sm up this is the handoff's row again. */}
            <div
              className={`flex flex-col gap-(--sp-5) sm:flex-row sm:flex-wrap sm:gap-(--sp-9) ${
                profile.cover ? "sm:items-start" : "sm:items-center"
              }`}
            >
              {/* Pre-optimized WebP served from storage (G2/G5) — next/image
                would only re-proxy an already-final asset from a runtime-
                configured host, as the settings page notes. */}
              {/* With a cover the avatar straddles its lower edge, half of it
                over the photo, ringed by the card so it reads on any photo. */}
              <Avatar
                src={profile.avatar?.url128 ?? null}
                name={profile.displayName}
                size={128}
                alt={t("avatarAlt", { name: profile.displayName })}
                className={`shrink-0 [--avatar-size:96px] sm:[--avatar-size:128px] ${
                  profile.cover
                    ? "-mt-(--sp-14) ring-4 ring-(--surface-card) sm:-mt-(--sp-16)"
                    : ""
                }`}
              />
              <div className="flex w-full min-w-0 flex-col gap-(--sp-5) sm:flex-1">
                {/* break-words is the guarantee, not the layout: a display
                  name is one 80-character field and may hold a single word
                  longer than any column we can give it. */}
                <h1 className="type-display break-words text-(--text-strong)">
                  {profile.displayName}
                </h1>
                <HeadlineView headline={profile.headline} />
              </div>
            </div>
            {/* #72 / A12: the sections, each absent when the profile has
              nothing there — the same components the owner sees. */}
            <LocationsView locations={profile.locations} />
            <BioView bio={profile.bio} />
          </div>
        </Card>
        {/* #72 / A12: the works, when there are any — a visitor sees the
            cards and the photo overlay, never the R360 state. */}
        {profile.works.length > 0 && (
          <section className="flex flex-col gap-(--sp-5)">
            <h2 className="type-h2 text-(--text-strong)">
              {tWorks("heading")}
            </h2>
            <WorksGallery works={profile.works} />
          </section>
        )}
      </main>
      <div className="mx-auto flex max-w-(--measure-page) justify-center px-(--sp-5) py-(--sp-7) sm:px-(--sp-7) sm:py-(--sp-8)">
        <Plaque
          name={profile.displayName}
          width={150}
          tilt={0}
          shadow={false}
        />
      </div>
      <Footer maxWidth="measure-page" />
    </>
  );
}

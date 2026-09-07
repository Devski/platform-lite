import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { signedInDestination } from "@/lib/signed-in-destination";

// The 404 body for everything under [locale]: an address that belongs to no
// profile (#18) and any other notFound() a page throws. It renders inside the
// locale layout, so getTranslations() reads the request's locale exactly as
// the pages do (A8) — no params reach a not-found boundary.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  return { title: t("title") };
}

export default async function NotFoundPage() {
  const t = await getTranslations("NotFound");
  // The hero is unreachable once signed in (screen 1), so "back home" from
  // here means the same thing it means there: the visitor's own public
  // profile, or onboarding if they haven't set a handle yet. Link (from
  // @/i18n/navigation) prefixes this with the current locale itself.
  const homeHref = (await signedInDestination()) ?? "/";

  return (
    <main className="flex min-h-screen items-center justify-center bg-(--surface-page) p-(--sp-9)">
      <div className="grid w-full max-w-[560px] grid-cols-2 overflow-hidden rounded-md border border-(--border-default)">
        <div className="relative min-h-[340px]">
          {/* Decorative: the heading and button carry the page's meaning. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-facade-plaque.webp"
            alt=""
            aria-hidden="true"
            width={2400}
            height={1340}
            className="absolute inset-0 h-full w-full object-cover [object-position:96%_42%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(12,17,22,.5), rgba(12,17,22,0) 55%)",
            }}
          />
        </div>
        <div className="flex flex-col items-start justify-center gap-(--sp-5) bg-(--surface-card) p-(--sp-9)">
          <Icon name="map-pin-off" size={24} className="text-(--text-subtle)" />
          <h1 className="type-h2 text-(--text-strong)">{t("heading")}</h1>
          <ButtonLink variant="quiet" href={homeHref}>
            {t("homeLink")}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}

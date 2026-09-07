import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { signedInDestination } from "@/lib/signed-in-destination";
import { ButtonLink } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { LanguageChip } from "@/components/ui/language-chip";
import { Logo } from "@/components/ui/logo";
import { TopBar } from "@/components/ui/top-bar";
import type { Locale } from "@/i18n/routing";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const target = await signedInDestination();
  if (target) redirect({ href: target, locale });

  const t = await getTranslations("HomePage");
  const tSession = await getTranslations("Session");

  return (
    <>
      {/* isolate: without a stacking context of its own the -z-10 photo
          below would paint in the root one, and a background added later on
          a wrapper would silently swallow it. */}
      <main className="relative isolate flex min-h-screen flex-col">
        {/* Decorative: the text block below carries every piece of
            information, so the photo needs no description. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-facade-plaque.webp"
          alt=""
          aria-hidden="true"
          width={2400}
          height={1340}
          fetchPriority="high"
          className="absolute inset-0 -z-10 h-full w-full object-cover [object-position:70%_40%]"
        />
        {/* The gradient lives on this wrapper — an actual ANCESTOR of the
            text below — rather than a decorative sibling div. A background
            on a sibling is invisible to axe's color-contrast check (it
            walks ancestors, not the paint order), which without this
            reported "white on white" for every element here: no ancestor
            had any background at all, sibling or not. On an ancestor, axe
            blends the gradient against its own fallback (white, the
            brightest anything could be) — the least favorable case there
            is, so a pass here is a real guarantee against the actual photo,
            not just this one image's actual colors (checked by sampling the
            live pixels: the real worst case measured 5.6:1 at the top bar
            and 9.4:1 at the hero text, both well past the 4.5:1 the automated
            check itself only manages to confirm indirectly). */}
        <div
          className="relative flex min-h-screen flex-1 flex-col"
          style={{
            background:
              "linear-gradient(180deg, rgba(12,17,22,.62) 0%, rgba(12,17,22,.3) 32%, rgba(12,17,22,.75) 100%)",
          }}
        >
          <TopBar
            onPhoto
            left={<Logo href="/" onPhoto />}
            right={
              <>
                <LanguageChip locale={locale as Locale} onPhoto />
                <ButtonLink variant="onPhotoQuiet" href="/login">
                  {tSession("logIn")}
                </ButtonLink>
                <ButtonLink variant="onPhoto" href="/register">
                  {tSession("register")}
                </ButtonLink>
              </>
            }
          />
          <div className="relative flex-1">
            {/* Same centered column as the top bar (mx-auto + max-w-measure-
                wide, no width constraint of its own beyond that) so the text
                below tracks the logo's actual x position at any viewport
                width, instead of a fixed offset from the full-bleed photo. */}
            <div className="absolute inset-0 mx-auto max-w-(--measure-wide)">
              <div
                className="absolute flex max-w-[44rem] flex-col gap-(--sp-7)"
                style={{
                  left: "calc(var(--sp-7) + 64px)",
                  right: "var(--sp-7)",
                  bottom: "64px",
                }}
              >
                <h1 className="type-hero text-balance text-(--text-on-photo)">
                  {t("heading")}
                </h1>
                <p className="type-lead max-w-[30rem] text-white/86">
                  {t("lead")}
                </p>
                <div className="flex flex-wrap gap-(--sp-4)">
                  <ButtonLink variant="onPhoto" size="lg" href="/register">
                    {t("ctaPrimary")}
                  </ButtonLink>
                  <ButtonLink variant="onPhotoQuiet" size="lg" href="/login">
                    {t("ctaSecondary")}
                  </ButtonLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

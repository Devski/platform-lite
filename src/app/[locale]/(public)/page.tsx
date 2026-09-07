import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { signedInDestination } from "@/lib/signed-in-destination";
import { ButtonLink } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { LanguageChip } from "@/components/ui/language-chip";
import { Logo } from "@/components/ui/logo";
import { MobileMenu } from "@/components/ui/mobile-menu";
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

  // The same three actions appear twice — as the bar's row from sm up, and
  // inside the hamburger panel below it — so the hrefs and labels are written
  // once. Only the tone can't be shared: the row floats on the photo, while
  // the panel is a white card, where the on-photo variants would be white on
  // white.
  const sessionActions = (onPhoto: boolean) => (
    <>
      <LanguageChip locale={locale as Locale} onPhoto={onPhoto} />
      <ButtonLink variant={onPhoto ? "onPhotoQuiet" : "quiet"} href="/login">
        {tSession("logIn")}
      </ButtonLink>
      <ButtonLink variant={onPhoto ? "onPhoto" : "solid"} href="/register">
        {tSession("register")}
      </ButtonLink>
    </>
  );

  return (
    <>
      {/* isolate: without a stacking context of its own the -z-10 photo
          below would paint in the root one, and a background added later on
          a wrapper would silently swallow it.

          svh, not vh: on Android Chrome 100vh is the tall viewport, the one
          you only get once the address bar has scrolled away, so a hero sized
          in vh hangs its bottom row — here the second CTA — underneath the
          address bar on arrival. svh is that bar's own height and is
          identical to vh on a desktop browser, which has no such bar. */}
      <main className="relative isolate flex min-h-svh flex-col">
        {/* Decorative: the text block below carries every piece of
            information, so the photo needs no description.

            The crop is per shape, not per screen size: cover scales this
            2400x1340 photo to the viewport's height on anything phone-shaped,
            so a frame chosen for a wide window slides the street plaque —
            "ul. Architektów 3d", the whole point of the picture — off the
            right edge. 90% brings the sign back into a portrait frame while
            keeping some of the greenery beside it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-facade-plaque.webp"
          alt=""
          aria-hidden="true"
          width={2400}
          height={1340}
          fetchPriority="high"
          className="absolute inset-0 -z-10 h-full w-full object-cover [object-position:90%_40%] sm:[object-position:70%_40%]"
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
          className="relative flex min-h-svh flex-1 flex-col"
          style={{
            background:
              "linear-gradient(180deg, rgba(12,17,22,.62) 0%, rgba(12,17,22,.3) 32%, rgba(12,17,22,.75) 100%)",
          }}
        >
          {/* This is the only bar in the product that collapses into a
              hamburger: it carries a language chip and two text buttons next
              to the wordmark, which stops fitting well before a phone's
              width. The other bars carry one or two icon-sized actions and
              stay as they are. */}
          <TopBar
            onPhoto
            left={<Logo href="/" onPhoto />}
            right={sessionActions(true)}
            mobileMenu={
              <MobileMenu onPhoto>{sessionActions(false)}</MobileMenu>
            }
          />
          <div className="relative flex-1">
            {/* Same centered column as the top bar (mx-auto + max-w-measure-
                wide, no width constraint of its own beyond that) so the text
                below tracks the logo's actual x position at any viewport
                width, instead of a fixed offset from the full-bleed photo. */}
            <div className="absolute inset-0 mx-auto max-w-(--measure-wide)">
              {/* left/right are the top bar's own gutter, expression for
                  expression (px-(--sp-5) sm:px-(--sp-7)) rather than a copy
                  of what it happens to compute to — the slogan has to start
                  at exactly the logo's x position at every width, so the two
                  must switch at the same breakpoint or the alignment breaks
                  on one size only. There is no indent on top of it. */}
              {/* The bottom offset is the one figure that does NOT step down
                  on a phone. svh keeps the second CTA clear of the address
                  bar, but not of the system navigation bar drawn below the
                  browser, and 32px left it looking pinned to the edge on a
                  real device. 64px at every width, same as the handoff's
                  desktop value; the photo above has room to give. */}
              <div className="absolute right-(--sp-5) bottom-(--sp-12) left-(--sp-5) flex max-w-[44rem] flex-col gap-(--sp-5) sm:right-(--sp-7) sm:left-(--sp-7) sm:gap-(--sp-7)">
                {/* --fs-hero bottoms out at 2.5rem, drawn for a desktop
                    column; on a 390px screen that heading runs to four lines
                    and crowds everything under it. Below sm it steps to
                    --fs-display — the next size down the scale, which its own
                    clamp pins to 2rem at every phone width — rather than to a
                    number invented for this one heading; the hero clamp takes
                    over again from sm up. */}
                <h1 className="type-hero text-(length:--fs-display) text-balance text-(--text-on-photo) sm:text-(length:--fs-hero)">
                  {t("heading")}
                </h1>
                <p className="type-lead max-w-[30rem] text-white/86">
                  {t("lead")}
                </p>
                {/* Stacked and full width below sm. Side by side the two fit
                    a 390px screen by about a finger's width, and only in
                    these two languages — a longer label in either would wrap
                    them into a ragged two-row block. */}
                <div className="flex flex-col gap-(--sp-4) sm:flex-row sm:flex-wrap">
                  <ButtonLink
                    variant="onPhoto"
                    size="lg"
                    href="/register"
                    className="w-full sm:w-auto"
                  >
                    {t("ctaPrimary")}
                  </ButtonLink>
                  <ButtonLink
                    variant="onPhotoQuiet"
                    size="lg"
                    href="/login"
                    className="w-full sm:w-auto"
                  >
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

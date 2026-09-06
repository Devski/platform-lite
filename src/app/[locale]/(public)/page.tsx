import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { FOCUS_RING } from "./focus-ring";
import { SessionPanel } from "./session-panel";

// A11: the photo a signed-out visitor lands on. Dawid's own photograph
// (decision #26, 06.09.2026) — a Warsaw street sign reading "ul. Architektów
// 3d", which is the product's name as an address. That is the whole idea of
// the product in one frame: everyone who signs up gets an address of their
// own. His, so no attribution or licence obligation rides on it.
//
// Pre-optimized WebP served straight from /public: 2400 px wide, 230 kB.
// next/image would only re-proxy an already-final asset, as the profile page
// notes.
const PHOTO_PATH = "/landing-architektow-3d.webp";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("HomePage");
  const tSwitcher = await getTranslations("LanguageSwitcher");

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Two thirds of the viewport, always (decision of 06.09.2026) — and
          nothing sits on top of it, so it really is two thirds rather than a
          band with an opaque card eating its lower half. The minimum stops a
          short window from crushing it to a stripe, and stays under two
          thirds of a landscape phone (66vh of 390 px = 257) so that it never
          becomes the thing that pushes the slogan off the screen.

          `isolate` is load-bearing: it gives this box a stacking context of
          its own, so the photo's `-z-10` stays inside it. Without it the photo
          would drop into the root context and paint behind `main`'s own white
          background — which exists, on line 28.

          svh, not vh: on a phone `vh` is the height with the browser chrome
          RETRACTED, so two thirds of it is nearly three quarters of what the
          visitor can actually see, and the buttons land under the address bar.
          At 375x812 the second one ended one pixel inside the viewport by that
          measure, which on a real handset means outside it. svh is the height
          with the chrome showing and, unlike dvh, does not change while the
          page scrolls — so nothing reflows on the way down. */}
      <div className="relative isolate h-[66svh] min-h-[240px] shrink-0">
        {/* Decorative: every word is in the block below, so the photo needs no
            description. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PHOTO_PATH}
          alt=""
          aria-hidden="true"
          width={2400}
          height={1340}
          fetchPriority="high"
          // Anchored right at EVERY size, and the breakpoint this once had was
          // wrong. The sign sits near the right edge of a landscape frame, so
          // whatever `object-cover` crops horizontally has to come off the
          // left. Whether it crops horizontally at all is decided by the box's
          // aspect ratio against the photo's 2400/1340 = 1.79, not by the
          // viewport's width: any box narrower than 1.18:1 loses width, which
          // is every phone AND every portrait tablet. `sm:object-center` cut
          // the sign to "ul. A… / 3 / Star" at 768x1024 — the same failure as
          // the 78% position rejected earlier. On a wide screen the whole
          // scene fits, nothing is cropped, and this class does nothing.
          className="absolute inset-0 -z-10 h-full w-full object-cover object-right"
        />
        {/* Fades the photo into the white page below so the two read as one
            surface. Carries no text on purpose — see the heading's note. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-white"
        />
      </div>

      {/* The words sit BELOW the photo on a plain white ground, and that is not
          a style choice. Contrast over a photograph cannot be computed — axe
          reports it as "incomplete", and e2e/axe.ts fails on an undecided
          contrast rule precisely so this decision cannot quietly switch the
          check off (its comment names #26). Text on a solid ground can be
          measured; text floating on an image cannot, by anyone, including a
          reader with low vision. The fade above does the joining, so the words
          still read as part of the photograph. */}
      <section className="w-full px-6 pt-5 pb-10 sm:px-10 sm:pt-6">
        <div className="mx-auto w-full max-w-3xl">
          {/* Semibold, not bold, and tracking opened up rather than tightened
              (Dawid's call, 06.09.2026): at display sizes the system font's
              bold weight closes the counters and the words turn into a block. */}
          <h1 className="text-[2rem] leading-[1.08] font-semibold tracking-[0.01em] text-balance text-gray-950 sm:text-5xl lg:text-6xl">
            {t("slogan")}
          </h1>
          <p className="mt-3 max-w-xl text-base text-gray-600 sm:mt-4 sm:text-lg">
            {t("lead")}
          </p>
          <div className="mt-5 sm:mt-6">
            <SessionPanel />
          </div>
        </div>
      </section>

      {/* The remaining third: what the product is, and the language choice.
          Same padding and measure as the block above, so the tagline starts on
          the same vertical line as the heading. */}
      <section className="flex w-full flex-1 flex-col px-6 pb-8 sm:px-10">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-between gap-8">
          <p className="text-lg text-gray-600">{t("tagline")}</p>
          {/* The brand sits BESIDE the switcher, not inside it: a screen-reader
              user entering a landmark labelled "language selection" should not
              be read the product name as its first item. */}
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold text-gray-900">{t("brand")}</span>
            <nav
              aria-label={tSwitcher("label")}
              className="flex items-center gap-4"
            >
              {routing.locales.map((l) => (
                <Link
                  key={l}
                  href="/"
                  locale={l}
                  lang={l}
                  hrefLang={l}
                  // The name of each language is written in that language, so it
                  // needs its own lang for a screen reader to pronounce it (WCAG
                  // 3.1.2); aria-current says which page the visitor is on.
                  aria-current={l === locale ? "true" : undefined}
                  className={`py-1 ${FOCUS_RING} ${
                    l === locale
                      ? "font-semibold text-gray-900 underline"
                      : "text-gray-600 hover:underline"
                  }`}
                >
                  {tSwitcher(l)}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </section>
    </main>
  );
}

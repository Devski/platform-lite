import { getTranslations, setRequestLocale } from "next-intl/server";
import { SessionPanel } from "./session-panel";
import { TopBarMenu } from "./top-bar-menu";

// A11: the photo a signed-out visitor lands on. Dawid's own photograph
// (decision #26, 06.09.2026) — a Warsaw street sign reading "ul. Architektów
// 3d", which is the product's name as an address. That is the whole idea of
// the product in one frame: everyone who signs up gets an address of their
// own. His, so no attribution or licence obligation rides on it.
//
// Pre-optimized WebP served straight from /public: 2400 px wide, 230 kB.
// next/image would only re-proxy an already-final asset, as the profile page
// notes. #48 covers cutting a second, narrower source for phones.
const PHOTO_PATH = "/landing-architektow-3d.webp";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("HomePage");

  return (
    <>
      {/* The top bar: the wordmark, and everything else behind one button —
          Dawid, 06.09.2026. A real <header> outside <main>, so it is a banner
          landmark a screen reader can skip; nested in main it would be
          neither. Fixed height, because the hero below subtracts it from the
          viewport. */}
      <header className="flex h-14 items-center justify-between gap-4 bg-white px-4 sm:px-6">
        {/* "A3D" stands in until there is a drawn mark, so it is set as one:
            bold and letter-spaced, not body type. It is NOT translated — a
            wordmark that changed with the interface language would be a
            different mark — but the name behind it still has to reach a screen
            reader, or the banner announces three letters and nothing else. */}
        <span className="text-lg font-bold tracking-[0.06em] text-gray-950">
          <span aria-hidden="true">{t("wordmark")}</span>
          <span className="sr-only">{t("brand")}</span>
        </span>
        <TopBarMenu locale={locale} />
      </header>

      <main className="flex flex-col bg-white">
        {/* The photo runs full-bleed under the bar and, on a phone, fills the
            rest of the screen — no gradient, no fade, a hard edge (Dawid,
            06.09.2026). svh, not vh: vh is the height with the browser chrome
            RETRACTED, so it would push the card under the address bar, and
            unlike dvh it does not change while the page scrolls.

            min-height on a phone so the card can never overflow the frame it
            sits in; a fixed, capped height from `sm` up, because two thirds of
            a tall desktop window is an absurd amount of photograph.

            `isolate` keeps the layering below it — the photo, then the card
            on top — inside this box rather than in the page's own stacking
            context. */}
        <div className="relative isolate flex min-h-[calc(100svh-3.5rem)] flex-col justify-end sm:h-[68svh] sm:max-h-[720px] sm:min-h-[420px]">
          {/* Decorative: every word is in the card below, so the photo needs
              no description. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PHOTO_PATH}
            alt=""
            aria-hidden="true"
            width={2400}
            height={1340}
            fetchPriority="high"
            // Anchored right at EVERY size. The sign sits near the right edge
            // of a landscape frame, so whatever `object-cover` crops
            // horizontally has to come off the left — and whether it crops
            // horizontally at all is decided by the box's aspect ratio against
            // the photo's 2400/1340 = 1.79, not by the viewport's width. Any
            // box narrower than 1.18:1 loses width, which is every phone AND
            // every portrait tablet: a breakpoint here cut the sign to
            // "ul. A… / 3 / Star" at 768x1024.
            className="absolute inset-0 h-full w-full object-cover object-right"
          />

          {/* The words sit ON the photo, on an OPAQUE card — and the opacity
              is not a style choice. Contrast over a photograph cannot be
              computed: axe reports it as "incomplete", and e2e/axe.ts fails on
              an undecided contrast rule precisely so this decision cannot
              quietly switch the check off. Text on a solid ground can be
              measured; text floating on an image cannot, by anyone, including
              a reader with low vision. Insetting the card is what makes it
              read as part of the photograph — the picture runs behind it and
              out to all four edges — without asking anyone to read words off a
              tree.

              `relative z-10` is what makes the check work, and it took an
              experiment to find: with the photo behind on a NEGATIVE z-index,
              axe still called this "overlapped by another element" and refused
              to decide. Ordering the two positively — photo, then card — is
              the same picture and axe reads it correctly, so the rule stays
              armed rather than excused. Do not flatten this back. */}
          <div className="relative z-10 m-4 rounded-2xl bg-white px-6 py-6 sm:m-8 sm:max-w-xl sm:px-8 sm:py-8">
            {/* Semibold, not bold, and tracking opened up rather than
                tightened (Dawid's call, 06.09.2026): at display sizes a bold
                weight closes the counters and the words turn into a block. */}
            <h1 className="text-[2rem] leading-[1.08] font-semibold tracking-[0.01em] text-balance text-gray-950 sm:text-4xl lg:text-5xl">
              {t("slogan")}
            </h1>
            <p className="mt-3 text-base text-gray-600 sm:mt-4 sm:text-lg">
              {t("lead")}
            </p>
            <div className="mt-5 sm:mt-6">
              <SessionPanel />
            </div>
          </div>
        </div>

        {/* What the product is, under the photograph. */}
        <section className="w-full px-6 py-10 sm:px-10">
          <p className="mx-auto w-full max-w-3xl text-lg text-gray-600">
            {t("tagline")}
          </p>
        </section>
      </main>
    </>
  );
}

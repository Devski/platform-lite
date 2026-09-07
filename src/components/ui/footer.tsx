import { getTranslations } from "next-intl/server";
import { measureWidthClass, type MeasureWidth } from "./layout";

// Never shows the company name inside a copyright sentence: the company
// label is its own bold line, the copyright note underneath is bare "©
// 2026" with nothing repeated. No language switcher here — the top bar's
// LanguageChip is the only switcher in the design (design-system-source).
export async function Footer({
  maxWidth = "measure-wide",
}: {
  /** Same centered-column width as the page's TopBar, so the footer's
   * left edge lines up with the logo above it instead of drifting with
   * viewport width. */
  maxWidth?: MeasureWidth;
}) {
  const t = await getTranslations("Footer");
  const maxWidthClass = measureWidthClass(maxWidth);
  return (
    // A hairline + a page-tint background separate the footer from
    // whatever content sits directly above it, instead of blending in.
    <footer className="border-t border-(--border-hairline) bg-(--surface-page)">
      {/* The horizontal padding is the top bar's gutter, expression for
          expression, so the company line keeps sitting under the logo on a
          phone as well; the vertical one steps down with it. */}
      <div
        className={`mx-auto flex flex-col items-start gap-(--sp-1) px-(--sp-5) py-(--sp-7) text-left sm:px-(--sp-7) sm:py-(--sp-8) ${maxWidthClass}`}
      >
        <p className="type-label text-(--text-strong)">{t("company")}</p>
        {/* --text-subtle (n-500) measures under 4.5:1 on a white/page
            background at this weight and size — AA needs --text-muted here. */}
        <p className="type-sm text-(--text-muted)">{t("copyright")}</p>
      </div>
    </footer>
  );
}

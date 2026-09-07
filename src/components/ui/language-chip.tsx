"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { useDismissable } from "./use-dismissable";

// Simple two-color rects, not emoji flags (design-system-source note).
const FLAG_COLORS: Record<Locale, [string, string]> = {
  pl: ["#ffffff", "#dc143c"],
  en: ["#0f4eb1", "#c9150f"],
};

function Flag({ locale }: { locale: Locale }) {
  const [top, bottom] = FLAG_COLORS[locale];
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] border border-(--border-default)"
    >
      <span className="block h-1/2" style={{ backgroundColor: top }} />
      <span className="block h-1/2" style={{ backgroundColor: bottom }} />
    </span>
  );
}

// A chip that opens to the other supported language — collapsed, it shows
// only the current one (flag + name + chevron), never a second inline link.
export function LanguageChip({
  locale,
  onPhoto = false,
}: {
  locale: Locale;
  onPhoto?: boolean;
}) {
  const t = useTranslations("LanguageSwitcher");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismissable(open, containerRef, () => setOpen(false));
  const tone = onPhoto
    ? "text-(--text-on-photo) hover:bg-white/10"
    : "text-(--text-body) hover:bg-(--surface-hover)";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex h-(--control-h) items-center gap-(--sp-3) rounded-sm px-(--sp-3) type-sm ${tone}`}
      >
        <Flag locale={locale} />
        {t(locale)}
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <nav
          aria-label={t("label")}
          className="absolute top-full right-0 z-10 mt-(--sp-2) min-w-full rounded-sm border border-(--border-default) bg-(--surface-card) py-(--sp-2) shadow-md"
        >
          {routing.locales.map((l) => (
            <Link
              key={l}
              href={pathname}
              locale={l}
              lang={l}
              hrefLang={l}
              aria-current={l === locale ? "true" : undefined}
              onClick={() => setOpen(false)}
              className="flex items-center gap-(--sp-3) px-(--sp-4) py-(--sp-2) type-sm text-(--text-body) hover:bg-(--surface-hover)"
            >
              <Flag locale={l} />
              {t(l)}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

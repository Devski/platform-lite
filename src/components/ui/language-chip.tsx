"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, type ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { useDismissable } from "./use-dismissable";

// Drawn, not emoji flags (design-system-source note). Each is authored on the
// same 60x30 field and stretched to the chip's box, so both sit identically.
// The Union Jack follows the official construction — widths as fractions of
// the hoist, and the red saltire counterchanged (offset to one side of each
// arm), which is what separates it from a generic diagonal cross. The clip id
// is passed in because it has to be unique to the rendered instance.
const FLAG_SHAPES: Record<Locale, (clipId: string) => ReactNode> = {
  pl: () => (
    <>
      <rect width="60" height="15" fill="#ffffff" />
      <rect y="15" width="60" height="15" fill="#dc143c" />
    </>
  ),
  en: (clipId) => (
    <>
      {/* Four triangles, one per arm, each bounded by the diagonal itself:
          clipping the centred red stroke with them leaves the offset half. */}
      <clipPath id={clipId}>
        <path d="M30 15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0 L60 30 M60 0 L0 30" stroke="#ffffff" strokeWidth={6} />
      <path
        d="M0 0 L60 30 M60 0 L0 30"
        clipPath={`url(#${clipId})`}
        stroke="#c8102e"
        strokeWidth={4}
      />
      <path d="M30 0 v30 M0 15 h60" stroke="#ffffff" strokeWidth={10} />
      <path d="M30 0 v30 M0 15 h60" stroke="#c8102e" strokeWidth={6} />
    </>
  ),
};

function Flag({ locale }: { locale: Locale }) {
  // useId's raw value is wrapped in punctuation a url(#...) fragment can't
  // carry, so only the unique part of it is kept.
  const clipId = `flag-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] border border-(--border-default)"
    >
      <svg
        viewBox="0 0 60 30"
        preserveAspectRatio="none"
        fill="none"
        className="block h-full w-full"
      >
        {FLAG_SHAPES[locale](clipId)}
      </svg>
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

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { FlagGb, FlagPl } from "./flags";
import { FOCUS_RING } from "./focus-ring";

// Everything the top bar offers, behind one button (Dawid, 06.09.2026).
// Today that is the language; the point of the pattern is that the next thing
// added has somewhere to go.

const FLAGS = { pl: FlagPl, en: FlagGb } as const;

export function TopBarMenu({ locale }: { locale: string }) {
  const t = useTranslations("Menu");
  const tSwitcher = useTranslations("LanguageSwitcher");
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The panel is REMOVED when closed, not merely hidden. A panel that is only
  // invisible keeps its links in the tab order and in the accessibility tree,
  // so a keyboard visitor lands inside a menu nobody can see.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Focus goes back to the button that opened it, or it would fall to the
      // top of the document and the visitor would lose their place.
      buttonRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        // aria-expanded is the whole contract for a disclosure: without it a
        // screen reader announces a button and never says the state changed.
        aria-expanded={open}
        aria-controls="top-bar-menu"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={`-mr-2 flex h-10 w-10 items-center justify-center rounded-md text-gray-950 hover:bg-gray-100 ${FOCUS_RING}`}
      >
        <span className="sr-only">{t("label")}</span>
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M3 6h18M3 12h18M3 18h18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          id="top-bar-menu"
          className="absolute top-full right-0 z-20 mt-2 min-w-44 rounded-xl border border-gray-200 bg-white py-2 shadow-lg"
        >
          <nav aria-label={tSwitcher("label")}>
            <ul>
              {routing.locales.map((l) => {
                const Flag = FLAGS[l];
                return (
                  <li key={l}>
                    <Link
                      href="/"
                      locale={l}
                      lang={l}
                      hrefLang={l}
                      // The name of each language is written in that language,
                      // so it needs its own lang for a screen reader to
                      // pronounce it (WCAG 3.1.2); aria-current says which
                      // page the visitor is on.
                      aria-current={l === locale ? "true" : undefined}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-100 ${FOCUS_RING} ${
                        l === locale
                          ? "font-semibold text-gray-950"
                          : "text-gray-700"
                      }`}
                    >
                      <Flag />
                      {tSwitcher(l)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";
import { useDismissable } from "./use-dismissable";

// The hamburger that carries a top bar's action row below sm. Only the
// homepage hero needs one — it packs a language chip and two buttons next to
// the logo, which stops fitting somewhere under 600px — so TopBar takes this
// as an optional slot rather than collapsing every bar (the profile and
// settings bars carry one or two icon-sized actions that fit a phone fine).
//
// The panel is always a card surface, even when the trigger sits on the hero
// photo: `onPhoto` tones the button alone, and the children inside use their
// normal on-card variants.
export function MobileMenu({
  children,
  onPhoto = false,
}: {
  children: ReactNode;
  onPhoto?: boolean;
}) {
  const t = useTranslations("MobileMenu");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismissable(open, containerRef, () => setOpen(false));

  const tone = onPhoto
    ? "text-(--text-on-photo) hover:bg-white/10 focus-visible:shadow-[var(--ring-focus-inverse)]"
    : "text-(--text-body) hover:bg-(--surface-hover) focus-visible:shadow-[var(--ring-focus)]";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t("menuLabel")}
        title={t("menuLabel")}
        className={`flex h-(--control-h) w-(--control-h) items-center justify-center rounded-sm focus-visible:outline-none ${tone}`}
      >
        <Icon name="menu" size={22} />
      </button>
      {open && (
        // A named <nav>, not AccountMenu's role="menu": that role promises
        // menuitem children, and this panel holds whatever actions the bar
        // was already showing — links, buttons, a nested language chip.
        // aria-expanded on the trigger is what announces the disclosure.
        <nav
          aria-label={t("menuLabel")}
          // A column flex box, so children stretch to the panel width on
          // their own — callers pass the same elements as the desktop row.
          className="absolute top-full right-0 z-10 mt-(--sp-2) flex w-[15rem] flex-col gap-(--sp-3) rounded-md border border-(--border-default) bg-(--surface-card) p-(--sp-4) shadow-md"
          // Leaving the page should leave the panel closed behind you. Keyed
          // on anchors specifically: the language chip's own trigger is a
          // <button>, so opening it keeps this panel up.
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {children}
        </nav>
      )}
    </div>
  );
}

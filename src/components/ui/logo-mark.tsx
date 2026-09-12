import type { ComponentPropsWithoutRef } from "react";
import { Link } from "@/i18n/navigation";
import { Mark } from "./mark";

type LogoMarkProps = {
  /**
   * Left out where the logo must not lead anywhere: above the auth cards, a
   * visitor part-way through making an account is not offered a way out of
   * the view (#66). No href, no anchor — rather than a link and a second
   * prop that could contradict it.
   */
  href?: ComponentPropsWithoutRef<typeof Link>["href"];
  wordmark: string;
  onPhoto?: boolean;
  /** "compact" is the smaller mark+type-h4 pairing above the auth cards
   * (screens 4/5); "default" is the 30px/type-h3 top-bar pairing. */
  size?: "default" | "compact";
};

// The presentational half of Logo, split out so a client component (which
// can't await Logo's own getTranslations call) can render the same mark +
// wordmark — see owner-profile-view.tsx.
export function LogoMark({ href, wordmark, onPhoto = false, size = "default" }: LogoMarkProps) {
  const ring = onPhoto
    ? "focus-visible:shadow-[var(--ring-focus-inverse)]"
    : "focus-visible:shadow-[var(--ring-focus)]";
  const text = onPhoto ? "text-(--text-on-photo)" : "text-(--text-strong)";
  const markSize = size === "compact" ? 26 : 30;
  const wordmarkClass = size === "compact" ? "type-h4" : "type-h3";
  // whitespace-nowrap: "Architektów 3d" broke across two lines inside the top
  // bar on a phone, which stretched the bar and shoved the actions off screen.
  // It fits without wrapping at every width we support — 30px mark + 8px gap +
  // ~123px of wordmark is 161px of the 328px a 360px screen leaves between the
  // gutters — so the mark and type keep their one size rather than gaining a
  // second, smaller pairing to maintain.
  const row = "flex items-center gap-(--sp-3) whitespace-nowrap sm:gap-(--sp-4)";
  const mark = (
    <>
      <Mark size={markSize} />
      <span className={`${wordmarkClass} ${text}`}>{wordmark}</span>
    </>
  );
  // Not a link, not focusable, and nothing to announce beyond the wordmark
  // itself — a span, so a keyboard and a screen reader both pass it by.
  if (href === undefined) return <span className={row}>{mark}</span>;
  return (
    <Link
      href={href}
      className={`${row} rounded-xs focus-visible:outline-none ${ring}`}
    >
      {mark}
    </Link>
  );
}

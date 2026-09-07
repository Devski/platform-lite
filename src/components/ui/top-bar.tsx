import type { ReactNode } from "react";
import { measureWidthClass, type MeasureWidth } from "./layout";

// height:64px, padding:0 var(--sp-7), vertically centered content — the same
// bar on every screen of the product (design-system-source). `onPhoto` drops
// the card background/hairline for the homepage hero, where the bar floats
// over the photo instead of sitting on a surface.
//
// Below sm the bar steps down one notch on both axes — 56px tall, 16px
// gutters — because the handoff only drew the desktop case and 24px of gutter
// on a 390px phone is a tenth of the screen. Everything else is unchanged
// from sm up. The gutter is load-bearing beyond this file: it sets the x
// position the logo starts at, and the homepage hero aligns its slogan to
// exactly that edge, so the two must be changed together.
export function TopBar({
  left,
  right,
  mobileMenu,
  onPhoto = false,
  maxWidth = "measure-wide",
}: {
  left: ReactNode;
  right?: ReactNode;
  /** A MobileMenu that replaces `right` below sm — only for a bar whose
   * actions don't fit a phone. Without it `right` stays visible at every
   * width, which is what the profile and settings bars want. */
  mobileMenu?: ReactNode;
  onPhoto?: boolean;
  /** Which spacing.css measure the centered content column uses — matches
   * the design-system-source reference per screen (the public profile uses
   * measure-page, the homepage measure-wide). Must match the page's Footer. */
  maxWidth?: MeasureWidth;
}) {
  const maxWidthClass = measureWidthClass(maxWidth);
  return (
    <div
      className={
        onPhoto
          ? "sticky top-0 z-20"
          : "sticky top-0 z-20 border-b border-(--border-hairline) bg-(--surface-card)"
      }
    >
      <div
        className={`mx-auto flex h-(--sp-11) items-center justify-between gap-(--sp-4) px-(--sp-5) sm:h-(--sp-12) sm:px-(--sp-7) ${maxWidthClass}`}
      >
        <div className="flex min-w-0 items-center gap-(--sp-6)">{left}</div>
        {right && (
          <div
            className={`items-center gap-(--sp-4) sm:gap-(--sp-6) ${
              mobileMenu ? "hidden sm:flex" : "flex"
            }`}
          >
            {right}
          </div>
        )}
        {mobileMenu && <div className="sm:hidden">{mobileMenu}</div>}
      </div>
    </div>
  );
}

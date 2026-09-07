import type { ReactNode } from "react";
import { measureWidthClass, type MeasureWidth } from "./layout";

// height:64px, padding:0 var(--sp-7), vertically centered content — identical
// on every screen (design-system-source). `onPhoto` drops the card
// background/hairline for the homepage hero, where the bar floats over the
// photo instead of sitting on a surface.
export function TopBar({
  left,
  right,
  onPhoto = false,
  maxWidth = "measure-wide",
}: {
  left: ReactNode;
  right?: ReactNode;
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
        className={`mx-auto flex h-(--sp-12) items-center justify-between px-(--sp-7) ${maxWidthClass}`}
      >
        <div className="flex items-center gap-(--sp-6)">{left}</div>
        {right && (
          <div className="flex items-center gap-(--sp-6)">{right}</div>
        )}
      </div>
    </div>
  );
}

export type MeasureWidth = "measure-wide" | "measure-page";

// Tailwind's scanner needs the full class name literally in source, so this
// can't be built from a template string — shared by TopBar and Footer, which
// must always agree on a screen's centered-column width.
export function measureWidthClass(maxWidth: MeasureWidth): string {
  return maxWidth === "measure-page"
    ? "max-w-(--measure-page)"
    : "max-w-(--measure-wide)";
}

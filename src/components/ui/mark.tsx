// The A3D mark: a 30×30 navy square with "A3D" in white, and a thin red band
// along the bottom 12% of its height (design-system-source, colors.css).
// Never used for interface chrome beyond this one spot — the rest of the
// palette is monochrome.
export function Mark({ size = 30, className }: { size?: number; className?: string }) {
  const bandHeight = size * 0.12;
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block shrink-0 overflow-hidden rounded-xs bg-plaque-navy ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-x-0 bottom-0 bg-plaque-red"
        style={{ height: bandHeight }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center font-sans font-bold text-white"
        style={{ fontSize: size * 0.34, paddingBottom: bandHeight / 2 }}
      >
        {"A3D"}
      </span>
    </span>
  );
}

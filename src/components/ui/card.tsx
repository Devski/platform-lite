import type { ElementType, ComponentPropsWithoutRef } from "react";

type CardOwnProps = {
  padding?: "sm" | "default" | "lg";
  /** "sunken" is the grey, recessed tone used for scope/notice rows. */
  tone?: "default" | "sunken";
  as?: ElementType;
};

type CardProps = CardOwnProps &
  Omit<ComponentPropsWithoutRef<"div">, keyof CardOwnProps>;

// Each step drops exactly one stop on the 4px scale below sm (16→12, 32→24,
// 48→40) and restores the handoff value from sm up. A card is usually the
// full width of a phone minus the page gutters, so its padding is subtracted
// from the content twice; one stop buys back 8–16px without turning the
// mobile card into a different component.
const PADDING = {
  sm: "p-(--sp-4) sm:p-(--sp-5)",
  default: "p-(--sp-7) sm:p-(--card-pad)",
  lg: "p-(--sp-9) sm:p-(--card-pad-lg)",
};

// 8px radius, no shadow, thin hairline border — borders carry structure in
// this system, shadows are a whisper reserved for the plaque graphic.
export function Card({
  padding = "default",
  tone = "default",
  as: Tag = "div",
  className = "",
  ...rest
}: CardProps) {
  const bg = tone === "sunken" ? "bg-(--surface-sunken)" : "bg-(--surface-card)";
  return (
    <Tag
      className={`rounded-md border border-(--border-hairline) ${bg} ${PADDING[padding]} ${className}`}
      {...rest}
    />
  );
}

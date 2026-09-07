import type { ElementType, ComponentPropsWithoutRef } from "react";

type CardOwnProps = {
  padding?: "sm" | "default" | "lg";
  /** "sunken" is the grey, recessed tone used for scope/notice rows. */
  tone?: "default" | "sunken";
  as?: ElementType;
};

type CardProps = CardOwnProps &
  Omit<ComponentPropsWithoutRef<"div">, keyof CardOwnProps>;

const PADDING = {
  sm: "p-(--sp-5)",
  default: "p-(--card-pad)",
  lg: "p-(--card-pad-lg)",
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

import type { ComponentProps, ComponentPropsWithoutRef } from "react";
import { Link } from "@/i18n/navigation";

export type ButtonVariant = "solid" | "quiet" | "onPhoto" | "onPhotoQuiet";
export type ButtonSize = "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-(--sp-3) rounded-sm px-(--control-pad-x) type-label transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const SIZE: Record<ButtonSize, string> = {
  md: "h-(--control-h)",
  lg: "h-(--control-h-lg)",
};

// solid/quiet are for the page's normal (white/grey) surfaces. onPhoto is
// the primary CTA over the hero photo — a white pill (inverse of solid),
// not a near-black one that blends into the scrim. onPhotoQuiet is the
// ghost counterpart: the quiet variant's default grey border would
// disappear on a photo, so it borrows white instead.
const VARIANT: Record<ButtonVariant, string> = {
  solid:
    "bg-(--action-solid) text-(--action-solid-text) hover:bg-(--action-solid-hover) active:bg-(--action-solid-active) focus-visible:shadow-[var(--ring-focus)]",
  quiet:
    "border border-(--action-quiet-border) bg-transparent text-(--text-body) hover:bg-(--action-quiet-hover) focus-visible:shadow-[var(--ring-focus)]",
  onPhoto:
    "bg-(--surface-card) text-(--text-strong) hover:bg-n-100 active:bg-n-150 focus-visible:shadow-[var(--ring-focus-inverse)]",
  onPhotoQuiet:
    "border border-white/55 bg-transparent text-(--text-on-photo) hover:bg-white/10 focus-visible:shadow-[var(--ring-focus-inverse)]",
};

export function buttonClassName(
  variant: ButtonVariant = "solid",
  size: ButtonSize = "md",
  className = "",
): string {
  return `${BASE} ${SIZE[size]} ${VARIANT[variant]} ${className}`;
}

// ComponentProps, not ComponentPropsWithoutRef: React 19 passes `ref` as a
// plain prop, and a caller that wants to move focus to a button (the
// confirm-delete row, #72) needs it to reach the element.
type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName(variant, size, className)}
      {...rest}
    />
  );
}

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClassName(variant, size, className)} {...rest} />
  );
}

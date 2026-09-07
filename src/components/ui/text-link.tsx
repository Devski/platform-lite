import type { ComponentPropsWithoutRef } from "react";
import { Link } from "@/i18n/navigation";

type Tone = "default" | "muted";

// Shared with plain <button> elements that need the same look for a
// non-navigating action (a resend, a "back" step) — see textButtonClassName.
function toneColor(tone: Tone): string {
  return tone === "muted" ? "text-(--text-muted)" : "text-(--text-strong)";
}

type TextLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  tone?: Tone;
};

export function TextLink({ tone = "default", className = "", ...rest }: TextLinkProps) {
  return (
    <Link
      className={`type-sm font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)] ${toneColor(tone)} ${className}`}
      {...rest}
    />
  );
}

// The button-element counterpart of TextLink, for actions that aren't
// navigation (resend a code, step back in a form) — same visual language,
// including the focus ring and a disabled state Link has no use for.
export function textButtonClassName(tone: Tone = "default", className = ""): string {
  return `type-sm font-medium underline hover:no-underline focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)] disabled:text-(--text-subtle) disabled:no-underline ${toneColor(tone)} ${className}`;
}

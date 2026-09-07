import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-(--border-default) bg-(--surface-card) text-(--text-muted)",
  success: "border-transparent bg-(--state-success-bg) text-(--state-success)",
  danger: "border-transparent bg-(--state-danger-bg) text-(--state-danger)",
};

export function Badge({
  children,
  uppercase = false,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  uppercase?: boolean;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-(--sp-1) rounded-full border px-(--sp-3) py-(--sp-1) ${TONE_CLASS[tone]} ${
        uppercase ? "type-eyebrow" : "type-label"
      } ${className}`}
    >
      {children}
    </span>
  );
}

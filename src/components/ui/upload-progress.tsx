"use client";

import { useTranslations } from "next-intl";
import { Icon } from "./icon";

// #80: one look for every upload on the platform — the avatar, the cover,
// a work photo, the R360 archive. A bar for the bytes on their way (the
// browser reports them), then "processing" while the server decodes and
// publishes; a cancel while the bytes are still moving. `fraction` is
// 0..1; at 1 the bytes have landed and the rest is the server's.
export function UploadProgress({
  fraction,
  label,
  onCancel,
  compact = false,
  className = "",
}: {
  fraction: number;
  /** What is uploading, for the screen reader: the bar's name. */
  label: string;
  /** Stops the transfer; offered only while the bytes are still moving. */
  onCancel?: () => void;
  /** Inside a tile: the bar and the number only, no words. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("Settings.profile.upload");
  const percent = Math.min(100, Math.max(0, Math.floor(fraction * 100)));
  const processing = fraction >= 1;
  const valueText = processing ? t("processing") : t("progress", { percent });
  // Announced once at the start and once when the bytes have landed — not
  // every percent, which would chatter. A progressbar is not live itself.
  const announced = processing ? t("processing") : label;

  return (
    <div
      className={`flex items-center gap-(--sp-3) ${compact ? "" : "min-w-0"} ${className}`}
    >
      <span className="sr-only" role="status">
        {announced}
      </span>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={processing ? undefined : percent}
        aria-valuetext={valueText}
        className={`relative h-1.5 flex-1 overflow-hidden rounded-full ${
          compact ? "bg-white/30" : "bg-(--surface-sunken)"
        }`}
      >
        <div
          className={`h-full rounded-full ${
            compact ? "bg-white" : "bg-(--action-solid)"
          } ${processing ? "motion-safe:animate-pulse" : "transition-[width] duration-200"}`}
          style={{ width: `${processing ? 100 : percent}%` }}
        />
      </div>
      <span
        className={`shrink-0 font-mono tabular-nums ${
          compact ? "type-eyebrow text-white" : "type-sm text-(--text-muted)"
        }`}
        aria-hidden="true"
      >
        {processing ? (compact ? "…" : t("processing")) : `${percent}%`}
      </span>
      {onCancel && !processing && (
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("cancel")}
          title={t("cancel")}
          className={`flex shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)] ${
            compact
              ? "h-7 w-7 bg-n-950/70 text-white hover:bg-n-950"
              : "h-8 w-8 text-(--text-muted) hover:bg-(--surface-sunken) hover:text-(--text-strong)"
          }`}
        >
          <Icon name="x" size={compact ? 12 : 14} />
        </button>
      )}
    </div>
  );
}

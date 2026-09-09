"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import type { R360Params } from "@/lib/r360/frame-set-shared";

// #103: the owner's four parameters of an R360 set, under the preview in
// the work form (the fifth, the frame count, is the set's, shown read-only
// beside the preview). The direction is a two-way toggle, frames per
// picture width a slider from 1 to N, the start frame is set from the
// frame in view, the ring flattening a slider from 0.15 to 1 with a
// "circle" button — its effect waits for the ring dial (#106).

export function R360ParamControls({
  params,
  frameInView,
  disabled,
  onChange,
}: {
  params: R360Params;
  /** The preview's frame, 1..N: what "use this frame" takes. */
  frameInView: number;
  disabled: boolean;
  onChange: (change: Partial<R360Params>) => void;
}) {
  const t = useTranslations("Works.form.r360");
  return (
    <div className="grid gap-(--sp-4) sm:grid-cols-2">
      <fieldset className="flex flex-col gap-(--sp-2)">
        <legend className="type-label text-(--text-body)">
          {t("paramDirection")}
        </legend>
        <div className="flex gap-(--sp-2)">
          {([1, -1] as const).map((direction) => {
            const active = params.direction === direction;
            return (
              <Button
                key={direction}
                variant={active ? "solid" : "quiet"}
                aria-pressed={active}
                onClick={() => onChange({ direction })}
                disabled={disabled}
              >
                {t(direction === 1 ? "directionForward" : "directionReverse")}
              </Button>
            );
          })}
        </div>
      </fieldset>
      <RangeParam
        name={t("paramFramesPerWidth")}
        shown={String(params.framesPerWidth)}
        min={1}
        max={params.frameCount}
        step={1}
        value={params.framesPerWidth}
        onChange={(framesPerWidth) => onChange({ framesPerWidth })}
        disabled={disabled}
        testId="work-r360-frames-per-width"
      />
      <div className="flex flex-col gap-(--sp-2)">
        {/* The value is announced when the button changes it: a status
            message, not a re-read of the whole block (#103 review). */}
        <ParamLabel
          name={t("paramStartFrame")}
          shown={String(params.startFrame)}
          shownTestId="work-r360-start-frame"
          live
        />
        <div>
          <Button
            variant="quiet"
            onClick={() => onChange({ startFrame: frameInView })}
            disabled={disabled}
          >
            {t("useThisFrame")}
          </Button>
        </div>
      </div>
      <RangeParam
        name={t("paramFlattening")}
        shown={params.flattening.toFixed(2)}
        min={0.15}
        max={1}
        step={0.01}
        value={params.flattening}
        onChange={(flattening) => onChange({ flattening })}
        disabled={disabled}
        testId="work-r360-flattening"
        hint={t("flatteningHint")}
      >
        <Button
          variant="quiet"
          onClick={() => onChange({ flattening: 1 })}
          disabled={disabled || params.flattening === 1}
        >
          {t("flatteningCircle")}
        </Button>
      </RangeParam>
    </div>
  );
}

/** A parameter's name and its value as the owner has it. */
function ParamLabel({
  name,
  shown,
  shownTestId,
  nameId,
  shownId,
  htmlFor,
  live = false,
}: {
  name: string;
  shown: string;
  shownTestId?: string;
  nameId?: string;
  shownId?: string;
  /** The control the name labels, when the name is a label. */
  htmlFor?: string;
  /** Announce the value when it changes. */
  live?: boolean;
}) {
  return (
    <span className="type-label text-(--text-body)">
      {htmlFor ? (
        <label id={nameId} htmlFor={htmlFor}>
          {name}
        </label>
      ) : (
        <span id={nameId}>{name}</span>
      )}
      {": "}
      <span
        id={shownId}
        className="font-normal tabular-nums"
        data-testid={shownTestId}
        aria-live={live ? "polite" : undefined}
      >
        {shown}
      </span>
    </span>
  );
}

/**
 * A parameter set on a slider, its value shown above it. The name alone
 * is the slider's label, the value its description — a label wrapping the
 * whole block would read the value, a button and the hint as the name
 * (#103 review). What comes as children sits beside the hint, outside.
 */
function RangeParam({
  name,
  shown,
  min,
  max,
  step,
  value,
  onChange,
  disabled,
  testId,
  hint,
  children,
}: {
  name: string;
  shown: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  testId: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  const inputId = useId();
  const shownId = useId();
  const hintId = useId();
  return (
    <div className="flex flex-col gap-(--sp-2)">
      <ParamLabel
        name={name}
        shown={shown}
        htmlFor={inputId}
        shownId={shownId}
      />
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        data-testid={testId}
        aria-describedby={hint ? `${shownId} ${hintId}` : shownId}
        className="accent-(--action-solid)"
      />
      {(hint || children) && (
        <span className="flex items-center gap-(--sp-3) type-sm text-(--text-muted)">
          {children}
          {hint && <span id={hintId}>{hint}</span>}
        </span>
      )}
    </div>
  );
}

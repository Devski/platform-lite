"use client";

import { useTranslations } from "next-intl";
import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cuesInOrder } from "@/lib/r360/cues";
import {
  R360_CUE_LABEL_MAX,
  R360_CUES_MAX,
  type R360Cue,
  type R360Params,
} from "@/lib/r360/frame-set-shared";
import { glides } from "@/lib/r360/orbit";

// #103: the owner's five parameters of an R360 set, under the preview in
// the work form (the sixth, the frame count, is the set's, shown read-only
// beside the preview). The direction is a two-way toggle, frames per
// picture width a slider from 1 to N, the start frame is set from the
// frame in view, the ring flattening a slider from 0.15 to 1 with a
// "circle" button, and the motion (#153) a two-way toggle like the
// direction. #107 adds the cue points below them.

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
      <TwoWayParam
        name={t("paramDirection")}
        disabled={disabled}
        choices={([1, -1] as const).map((direction) => ({
          key: String(direction),
          label: t(direction === 1 ? "directionForward" : "directionReverse"),
          active: params.direction === direction,
          pick: () => onChange({ direction }),
        }))}
      />
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
      >
        <Button
          variant="quiet"
          onClick={() => onChange({ flattening: 1 })}
          disabled={disabled || params.flattening === 1}
        >
          {t("flatteningCircle")}
        </Button>
      </RangeParam>
      {/* #153: what the visitor's orbit does — a travel that eases in and
          out of its frame, a drag that coasts on after the hand. Only OFF
          is written into the parameters: absent is on, so a work saved
          before the switch existed glides like the rest. */}
      <TwoWayParam
        name={t("paramGlide")}
        disabled={disabled}
        hint={t("glideHint")}
        choices={([true, false] as const).map((on) => ({
          key: String(on),
          label: t(on ? "glideOn" : "glideOff"),
          active: glides(params) === on,
          pick: () => onChange({ glide: on ? undefined : false }),
          testId: `work-r360-glide-${on ? "on" : "off"}`,
        }))}
      />
      {/* #175: how much it gathers pace and how much it settles, each its
          own half of the travel. Only under the switch: with the motion off
          there is no curve to shape. Absent means the full ease, so a work
          saved before these existed reads as 100/100 and feels unchanged. */}
      {glides(params) && (
        <>
          <RangeParam
            name={t("paramEaseIn")}
            shown={t("easePercent", { percent: easeAmount(params.easeIn) })}
            min={0}
            max={100}
            step={10}
            value={easeAmount(params.easeIn)}
            onChange={(percent) => onChange({ easeIn: percent / 100 })}
            disabled={disabled}
            testId="work-r360-ease-in"
          />
          <RangeParam
            name={t("paramEaseOut")}
            shown={t("easePercent", { percent: easeAmount(params.easeOut) })}
            min={0}
            max={100}
            step={10}
            value={easeAmount(params.easeOut)}
            onChange={(percent) => onChange({ easeOut: percent / 100 })}
            disabled={disabled}
            testId="work-r360-ease-out"
          />
        </>
      )}
      <CueControls
        params={params}
        frameInView={frameInView}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

/**
 * #107: the cue points — frames the owner names, which a visitor reaches
 * from a marker on the ring or a button under the picture. One is added at
 * the frame in view and named in place, its field taking the focus; each
 * goes with its own button. One a frame, twelve at most.
 */
function CueControls({
  params,
  frameInView,
  disabled,
  onChange,
}: {
  params: R360Params;
  frameInView: number;
  disabled: boolean;
  onChange: (change: Partial<R360Params>) => void;
}) {
  const t = useTranslations("Works.form.r360");
  const cues = params.cues ?? [];
  // The frame of the cue just added: its field takes the focus once, when
  // it is there to take it.
  const added = useRef<number | null>(null);
  const taken = cues.some((cue) => cue.frame === frameInView);
  const full = cues.length >= R360_CUES_MAX;
  // None left is no list at all — as a work saved without cues has it, so
  // adding one and removing it again leaves the form untouched.
  const commit = (next: R360Cue[]) =>
    onChange({ cues: next.length > 0 ? next : undefined });

  return (
    <fieldset
      className="flex flex-col gap-(--sp-3) sm:col-span-2"
      data-testid="work-r360-cues"
    >
      <legend className="type-label text-(--text-body)">
        {t("paramCues")}
      </legend>
      <p className="type-sm text-(--text-muted)">
        {t("cuesHint", { max: R360_CUES_MAX })}
      </p>
      {cues.length > 0 && (
        <ul className="flex flex-col gap-(--sp-2)">
          {cuesInOrder(cues, params).map((cue) => (
            <li key={cue.frame} className="flex items-center gap-(--sp-3)">
              <span className="w-20 shrink-0 type-sm tabular-nums text-(--text-muted)">
                {t("cueFrame", { frame: cue.frame })}
              </span>
              <Input
                ref={(element) => {
                  if (element && added.current === cue.frame) {
                    added.current = null;
                    element.focus();
                  }
                }}
                value={cue.label}
                maxLength={R360_CUE_LABEL_MAX}
                placeholder={t("cuePlaceholder")}
                aria-label={t("cueLabel", { frame: cue.frame })}
                disabled={disabled}
                onChange={(event) =>
                  commit(
                    cues.map((other) =>
                      other.frame === cue.frame
                        ? { ...other, label: event.target.value }
                        : other,
                    ),
                  )
                }
                className="min-w-0 flex-1"
              />
              <Button
                variant="quiet"
                onClick={() =>
                  commit(cues.filter((other) => other.frame !== cue.frame))
                }
                disabled={disabled}
                aria-label={t("cueRemoveLabel", { frame: cue.frame })}
              >
                {t("cueRemove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-(--sp-3)">
        <Button
          variant="quiet"
          onClick={() => {
            added.current = frameInView;
            commit([...cues, { frame: frameInView, label: "" }]);
          }}
          disabled={disabled || taken || full}
        >
          {t("cueAdd", { frame: frameInView })}
        </Button>
        {(full || taken) && (
          <span className="type-sm text-(--text-muted)">
            {full ? t("cuesFull", { max: R360_CUES_MAX }) : t("cueTaken")}
          </span>
        )}
      </div>
    </fieldset>
  );
}

/**
 * A parameter with two ways to be, a button each, the one in force
 * pressed. The direction (#103) and the motion (#153) are the same
 * control with different words in it.
 */
function TwoWayParam({
  name,
  choices,
  disabled,
  hint,
}: {
  name: string;
  choices: readonly {
    key: string;
    label: string;
    active: boolean;
    pick: () => void;
    testId?: string;
  }[];
  disabled: boolean;
  /** A line under the buttons saying what the choice does. */
  hint?: string;
}) {
  const hintId = useId();
  return (
    <fieldset className="flex flex-col gap-(--sp-2)">
      <legend className="type-label text-(--text-body)">{name}</legend>
      <div className="flex gap-(--sp-2)">
        {choices.map((choice) => (
          <Button
            key={choice.key}
            variant={choice.active ? "solid" : "quiet"}
            aria-pressed={choice.active}
            onClick={choice.pick}
            disabled={disabled}
            data-testid={choice.testId}
            // The legend names the parameter, not what choosing either
            // way does: without this a screen reader offers the choice
            // and withholds the explanation sighted eyes get for free.
            aria-describedby={hint ? hintId : undefined}
          >
            {choice.label}
          </Button>
        ))}
      </div>
      {hint && (
        <p id={hintId} className="type-sm text-(--text-muted)">
          {hint}
        </p>
      )}
    </fieldset>
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
 * whole block would read the value and the button as the name (#103
 * review). What comes as children sits below the slider, outside the
 * label.
 */
/**
 * #175: an amount as the slider shows it — whole percent, and absent
 * reading as 100, which is the ease #153 shipped and what every work saved
 * before these sliders existed still feels.
 */
function easeAmount(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 100;
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}

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
  children?: React.ReactNode;
}) {
  const inputId = useId();
  const shownId = useId();
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
        aria-describedby={shownId}
        className="accent-(--action-solid)"
      />
      {children && (
        <span className="flex items-center gap-(--sp-3) type-sm text-(--text-muted)">
          {children}
        </span>
      )}
    </div>
  );
}

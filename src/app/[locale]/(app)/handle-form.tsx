"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { textButtonClassName } from "@/components/ui/text-link";
import { postJson } from "@/lib/api-client";
import {
  HANDLE_CHANGE_COOLDOWN_DAYS,
  HANDLE_MAX,
  HANDLE_MIN,
  handleSchema,
  normalizeHandle,
} from "@/lib/handle";

// The #15 handle picker, shared by the onboarding step (the first
// assignment) and the settings section (a change under the A6 cooldown).
// The A5 rules run in the browser first — lib/handle is client-safe and the
// server enforces the same schema (§5) — and only a value that passes them
// asks the server whether it is free, debounced per keystroke.

const CHECK_DEBOUNCE_MS = 400;

// What the form decides on its own; null means "ask whether it is free".
type LocalVerdict = "empty" | "own" | "invalid" | "reserved" | null;

// The server's answer, plus the two ways a check ends without one.
type RemoteResult =
  | "available"
  | "taken"
  | "reserved"
  | "invalid"
  | "own"
  | "rateLimited"
  | "failed";

// The server's answer for exactly this value — a stale one is ignored.
interface RemoteCheck {
  handle: string;
  result: RemoteResult;
}

// What the field shows for a non-empty value: the local verdict (every
// non-empty one is also a possible server answer), the server's, or
// "checking" until it arrives.
type Verdict = RemoteResult | "checking";

// Verdicts with their own copy under the field.
type VerdictCopy =
  "checking" | "available" | "taken" | "reserved" | "invalid" | "own";

// Verdicts that make a submit pointless: red copy, button off.
const PROBLEMS: ReadonlySet<Verdict> = new Set([
  "taken",
  "reserved",
  "invalid",
]);

type Tone = "problem" | "success" | "neutral";

const NOTE_CLASS: Record<Tone, string> = {
  problem: "type-sm text-(--state-danger)",
  success: "type-sm text-(--state-success)",
  neutral: "type-sm text-(--text-muted)",
};

interface AvailabilityResponse {
  available?: boolean;
  reason?: "invalid" | "reserved" | "taken";
  own?: boolean;
}

interface SetHandleResponse {
  handle?: string;
  error?: string;
  retryAt?: string | null;
}

type SubmitError =
  | { code: "invalid" | "reserved" | "rateLimited" | "generic" }
  | { code: "cooldown"; retryAt: Date | null };

export interface HandleFormProps {
  /** The canonical origin (APP_URL) without a trailing slash. */
  origin: string;
  mode: "onboarding" | "settings";
  currentHandle: string | null;
  initialValue: string;
  /** ISO timestamp while the A6 cooldown runs; null when a change is allowed. */
  nextChangeAt: string | null;
  /**
   * Onboarding only (#36): the name collected in the step before this one,
   * sent with the claim so the profile row is created carrying it. The form
   * does not own it — the two are separate steps, and going back to edit the
   * name must not overwrite an address already chosen here.
   */
  displayName?: string;
  /** Onboarding only: returns to the name step. */
  onBack?: () => void;
}

function localVerdict(
  normalized: string,
  currentHandle: string | null,
): LocalVerdict {
  if (normalized === "") return "empty";
  if (normalized === currentHandle) return "own";
  const parsed = handleSchema.safeParse(normalized);
  if (parsed.success) return null;
  // The issue message IS the problem code (lib/handle).
  return parsed.error.issues[0]?.message === "reserved"
    ? "reserved"
    : "invalid";
}

function remoteResult(
  status: number,
  data: AvailabilityResponse,
): RemoteResult {
  if (status === 429) return "rateLimited";
  if (data.own) return "own";
  if (data.available) return "available";
  return data.reason ?? "failed";
}

function currentVerdict(
  local: LocalVerdict,
  remote: RemoteCheck | null,
  normalized: string,
): Verdict | null {
  if (local === "empty") return null;
  if (local !== null) return local;
  if (remote?.handle === normalized) return remote.result;
  return "checking";
}

export function HandleForm({
  origin,
  mode,
  currentHandle,
  initialValue,
  nextChangeAt,
  displayName,
  onBack,
}: HandleFormProps) {
  const t = useTranslations("HandleForm");
  const format = useFormatter();
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [remote, setRemote] = useState<RemoteCheck | null>(null);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  // What the last successful submit stored, and whether it replaced an
  // address (then the old one keeps redirecting, #16). Decided at submit
  // time: after router.refresh() the currentHandle prop is set even for a
  // first assignment, so it cannot tell the two apart.
  const [saved, setSaved] = useState<{
    address: string;
    redirects: boolean;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The server already applied "still in the future": non-null means locked.
  const cooldownUntil = nextChangeAt ? new Date(nextChangeAt) : null;
  const normalized = normalizeHandle(value);
  const local = localVerdict(normalized, currentHandle);

  // Only a locally valid value asks the server, and only once the typing
  // pauses; a newer keystroke aborts the check in flight.
  useEffect(() => {
    if (local !== null) return;
    const handle = normalized;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      let result: RemoteResult;
      try {
        const response = await fetch(
          `/api/handle/availability?handle=${encodeURIComponent(handle)}`,
          { signal: controller.signal },
        );
        result = remoteResult(
          response.status,
          (await response.json()) as AvailabilityResponse,
        );
      } catch {
        result = "failed";
      }
      if (!controller.signal.aborted) setRemote({ handle, result });
    }, CHECK_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [local, normalized]);

  const verdict = currentVerdict(local, remote, normalized);
  // A locally valid value the server has not refused; a check still in
  // flight (or one that failed) does not hold the button — the server is
  // the final judge either way.
  const canSubmit =
    !submitting &&
    cooldownUntil === null &&
    local === null &&
    verdict !== null &&
    !PROBLEMS.has(verdict);

  function formatDate(date: Date): string {
    // The app-wide time zone (src/i18n/request.ts) keeps the server and the
    // browser rendering the same day.
    return format.dateTime(date, { dateStyle: "long" });
  }

  // Every verdict message takes the same values; the ones without
  // placeholders ignore them.
  function verdictCopy(key: VerdictCopy): string {
    return t(key, { min: HANDLE_MIN, max: HANDLE_MAX });
  }

  function submitErrorCopy(error: SubmitError): string {
    switch (error.code) {
      case "invalid":
      case "reserved":
        return verdictCopy(error.code);
      case "cooldown": {
        const rule = t("errors.cooldown", {
          days: HANDLE_CHANGE_COOLDOWN_DAYS,
        });
        return error.retryAt
          ? `${rule} ${t("cooldownNote", { date: formatDate(error.retryAt) })}`
          : rule;
      }
      default:
        return t(`errors.${error.code}`);
    }
  }

  // One line under the field: the last submit's error wins over the live
  // verdict; a locked field (cooldown) shows neither.
  function feedback(): { text: string; tone: Tone } | null {
    if (cooldownUntil) return null;
    if (submitError) {
      return { text: submitErrorCopy(submitError), tone: "problem" };
    }
    if (verdict === null || verdict === "failed") return null;
    if (verdict === "rateLimited") {
      return { text: t("errors.rateLimited"), tone: "problem" };
    }
    if (PROBLEMS.has(verdict)) {
      return { text: verdictCopy(verdict), tone: "problem" };
    }
    return {
      text: verdictCopy(verdict),
      tone: verdict === "available" ? "success" : "neutral",
    };
  }

  function applyServerError(
    handle: string,
    status: number,
    data: SetHandleResponse,
  ) {
    if (status === 429) {
      setSubmitError({ code: "rateLimited" });
    } else if (data.error === "taken") {
      // The verdict the live check would give — and the same disabled button.
      setRemote({ handle, result: "taken" });
    } else if (data.error === "cooldown") {
      setSubmitError({
        code: "cooldown",
        retryAt: data.retryAt ? new Date(data.retryAt) : null,
      });
      // This page was rendered before the cooldown began (another tab or
      // device): re-render so the field locks the way a fresh load would.
      router.refresh();
    } else if (data.error === "invalid" || data.error === "reserved") {
      setSubmitError({ code: data.error });
    } else {
      setSubmitError({ code: "generic" });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitError(null);
    setSaved(null);
    setSubmitting(true);
    const handle = normalized;
    try {
      const response = await postJson<SetHandleResponse>(
        "/api/profile/handle",
        // The name rides with the claim only where it was asked for: a
        // later change of address must not clear a name edited since.
        // The name rides with the claim only in onboarding, where the step
        // before this one collected it. A later change of address must not
        // clear a name edited since.
        displayName === undefined ? { handle: value } : { handle: value, displayName },
      );
      if (!response.ok || !response.data.handle) {
        applyServerError(handle, response.status, response.data);
        return;
      }
      if (mode === "onboarding") {
        // Name and photo are the next steps toward the MVP goal (§1).
        router.push("/settings/profile");
        return;
      }
      // Show what was stored (normalized), not what was typed.
      setValue(response.data.handle);
      setSaved({
        address: `${origin}/${response.data.handle}`,
        redirects: currentHandle !== null,
      });
      router.refresh();
    } catch {
      // Network-level failure: postJson rethrows when no response arrived.
      setSubmitError({ code: "generic" });
    } finally {
      setSubmitting(false);
    }
  }

  const note = feedback();
  const problem = note?.tone === "problem";
  const describedBy = ["handle-hint"]
    .concat(note ? ["handle-feedback"] : [])
    .join(" ");

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-(--sp-3)"
    >
      <label htmlFor="handle" className="type-label text-(--text-body)">
        {t("label")}
      </label>
      {/* The prefix used to sit INSIDE the field, where it ate the width the
          address itself needed: on a phone the visitor could not see what
          they were typing (seen 05.09.2026). The field is the address alone
          now, full width, and the finished link is shown below it — where it
          can wrap instead of being cut off. */}
      <Input
        id="handle"
        name="handle"
        type="text"
        mono
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={HANDLE_MAX}
        required
        disabled={cooldownUntil !== null}
        value={value}
        onChange={(event) => {
          // Lowercase as typed, so the group always shows the exact
          // address that will be claimed; trimming stays server-side, so a
          // space mid-typing is not fought.
          setValue(event.target.value.toLowerCase());
          setSubmitError(null);
          setSaved(null);
        }}
        aria-invalid={problem ? true : undefined}
        aria-describedby={describedBy}
      />
      {normalized !== "" && (
        <p className="type-sm break-all text-(--text-muted)">
          <span className="sr-only">{t("addressPreviewLabel")}</span>
          <span className="font-mono">{`${origin}/${normalized}`}</span>
        </p>
      )}
      <p id="handle-hint" className="type-sm text-(--text-muted)">
        {t("hint", { min: HANDLE_MIN, max: HANDLE_MAX })}
      </p>
      {note && (
        <p
          id="handle-feedback"
          role={problem ? "alert" : "status"}
          className={NOTE_CLASS[note.tone]}
        >
          {note.text}
        </p>
      )}
      {cooldownUntil && (
        <p className="type-sm text-(--text-muted)" role="status">
          {t("cooldownNote", { date: formatDate(cooldownUntil) })}
        </p>
      )}
      {/* Forward-looking, and only where a change is what is happening: the
          first assignment does not start the clock, so onboarding has
          nothing to warn about. Told BEFORE the change, not after it — the
          note above only appears once the limit is already spent.

          Only once a DIFFERENT address is actually typed. Shown on arrival,
          beside a submit button that is greyed out because the field still
          holds the current address, it read as "you are blocked for 30
          days" — which is the opposite of what it says. */}
      {mode !== "onboarding" &&
        !cooldownUntil &&
        !saved &&
        normalized !== "" &&
        normalized !== currentHandle && (
          <p className="type-sm text-(--text-muted)">
            {t("cooldownAhead", { days: HANDLE_CHANGE_COOLDOWN_DAYS })}
          </p>
        )}
      {saved && (
        <p className="type-sm text-(--state-success)" role="status">
          {t("saved", { address: saved.address })}
        </p>
      )}
      {saved?.redirects && (
        <p className="type-sm text-(--text-muted)" role="status">
          {t("savedRedirect")}
        </p>
      )}
      <div className="flex items-center gap-(--sp-4)">
        <Button type="submit" size="lg" disabled={!canSubmit} className="self-start">
          {submitting
            ? t("submitting")
            : t(mode === "onboarding" ? "submitOnboarding" : "submitSettings")}
        </Button>
        {onBack && (
          <button type="button" onClick={onBack} className={textButtonClassName("muted")}>
            {t("back")}
          </button>
        )}
      </div>
    </form>
  );
}

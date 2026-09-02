"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
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
  problem: "text-sm text-red-700",
  success: "text-sm text-green-700",
  neutral: "text-sm text-gray-600",
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
        { handle: value },
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
  const describedBy = ["handle-prefix", "handle-hint"]
    .concat(note ? ["handle-feedback"] : [])
    .join(" ");

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-4 flex flex-col gap-3"
    >
      <label htmlFor="handle" className="text-sm font-medium text-gray-700">
        {t("label")}
      </label>
      <div className="flex rounded-md border border-gray-300 focus-within:border-blue-600">
        <span
          id="handle-prefix"
          className="flex shrink-0 select-none items-center rounded-l-md border-r border-gray-300 bg-gray-50 px-3 font-mono text-sm text-gray-500"
        >
          {`${origin}/`}
        </span>
        <input
          id="handle"
          name="handle"
          type="text"
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
          className="min-w-0 flex-1 rounded-r-md bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
        />
      </div>
      <p id="handle-hint" className="text-sm text-gray-500">
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
        <p className="text-sm text-gray-600" role="status">
          {t("cooldownNote", { date: formatDate(cooldownUntil) })}
        </p>
      )}
      {saved && (
        <p className="text-sm text-green-700" role="status">
          {t("saved", { address: saved.address })}
        </p>
      )}
      {saved?.redirects && (
        <p className="text-sm text-gray-600" role="status">
          {t("savedRedirect")}
        </p>
      )}
      <button
        type="submit"
        disabled={!canSubmit}
        className="self-start rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-gray-400"
      >
        {submitting
          ? t("submitting")
          : t(mode === "onboarding" ? "submitOnboarding" : "submitSettings")}
      </button>
    </form>
  );
}

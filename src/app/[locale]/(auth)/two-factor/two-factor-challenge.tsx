"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import type { Mode } from "./modes";

export function TwoFactorChallenge({ modes }: { modes: Mode[] }) {
  const t = useTranslations("TwoFactor");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(modes[0] ?? "otp");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setCode("");
    setError(null);
    setOtpSent(false);
  }

  async function sendCode() {
    setSending(true);
    setError(null);
    try {
      const { error: sendError } = await authClient.twoFactor.sendOtp();
      if (sendError) {
        setError(
          t(sendError.status === 429 ? "errors.rateLimited" : "errors.generic"),
        );
        return;
      }
      setOtpSent(true);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (code.trim().length === 0) {
      setError(t("errors.codeRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const { error: verifyError } = await (mode === "totp"
        ? authClient.twoFactor.verifyTotp({ code })
        : mode === "otp"
          ? authClient.twoFactor.verifyOtp({ code })
          : authClient.twoFactor.verifyBackupCode({ code }));
      if (!verifyError) {
        router.push("/");
        return;
      }
      if (verifyError.status === 401) setError(t("errors.invalidCode"));
      else if (verifyError.status === 429) setError(t("errors.locked"));
      else setError(t("errors.generic"));
    } catch {
      setError(t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  const codeReady = mode !== "otp" || otpSent;

  return (
    <div className="mt-6 flex flex-col gap-4">
      {modes.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist">
          {modes.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => switchMode(option)}
              className={
                mode === option
                  ? "rounded-md border border-blue-600 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800"
                  : "rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-blue-600"
              }
            >
              {t(`methods.${option}`)}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-600">{t(`intro.${mode}`)}</p>

      {mode === "otp" && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={sendCode}
            disabled={sending}
            className="self-start rounded-md border border-blue-600 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:text-gray-400"
          >
            {sending
              ? t("otp.sending")
              : otpSent
                ? t("otp.resend")
                : t("otp.send")}
          </button>
          {otpSent && (
            <p className="text-sm text-green-700" role="status">
              {t("otp.sent")}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="code" className="text-sm font-medium text-gray-700">
            {t(mode === "backup" ? "backupLabel" : "codeLabel")}
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode={mode === "backup" ? "text" : "numeric"}
            autoComplete="one-time-code"
            required
            disabled={!codeReady}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "code-error" : undefined}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none disabled:bg-gray-100"
          />
        </div>

        {error && (
          <p id="code-error" className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !codeReady}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-gray-400"
        >
          {submitting ? t("submitting") : t("submit")}
        </button>
      </form>
    </div>
  );
}

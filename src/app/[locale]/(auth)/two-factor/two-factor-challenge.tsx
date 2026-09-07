"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { textButtonClassName } from "@/components/ui/text-link";
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
      const verify = {
        totp: () => authClient.twoFactor.verifyTotp({ code }),
        otp: () => authClient.twoFactor.verifyOtp({ code }),
        backup: () => authClient.twoFactor.verifyBackupCode({ code }),
      };
      const { error: verifyError } = await verify[mode]();
      if (!verifyError) {
        // #15: the same landing as a password-only login — the onboarding
        // step forwards users who already have a handle to /.
        router.push("/onboarding");
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
    <div className="mt-(--sp-6) flex flex-col gap-(--sp-5)">
      {modes.length > 1 && (
        <div
          className="flex flex-wrap items-center gap-(--sp-3)"
          role="group"
          aria-label={t("methodsLabel")}
        >
          {modes.map((option) =>
            // Backup reads as a lightweight fallback, not a co-equal choice
            // (design-system-source's dedicated "use a backup code" link),
            // so it renders as a text link rather than a pill — same button
            // semantics and click handler as the other options either way.
            option === "backup" ? (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => switchMode(option)}
                className={textButtonClassName("muted")}
              >
                {t(`methods.${option}`)}
              </button>
            ) : (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => switchMode(option)}
                className={
                  mode === option
                    ? "flex items-center gap-(--sp-2) rounded-sm border border-(--action-solid) bg-(--surface-sunken) px-(--sp-3) py-(--sp-1) type-sm font-semibold text-(--text-strong)"
                    : "flex items-center gap-(--sp-2) rounded-sm border border-(--border-default) px-(--sp-3) py-(--sp-1) type-sm text-(--text-body) hover:border-(--action-solid)"
                }
              >
                {option === "totp" && <Icon name="smartphone" size={16} />}
                {t(`methods.${option}`)}
              </button>
            ),
          )}
        </div>
      )}

      <p className="type-sm text-(--text-muted)">{t(`intro.${mode}`)}</p>

      {mode === "otp" && (
        <div className="flex flex-col gap-(--sp-1)">
          <Button
            type="button"
            variant="quiet"
            onClick={sendCode}
            disabled={sending}
            className="self-start"
          >
            {sending
              ? t("otp.sending")
              : otpSent
                ? t("otp.resend")
                : t("otp.send")}
          </Button>
          {otpSent && (
            <p className="type-sm text-(--state-success)" role="status">
              {t("otp.sent")}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-(--sp-5)">
        <FormField
          label={t(mode === "backup" ? "backupLabel" : "codeLabel")}
          htmlFor="code"
        >
          <Input
            id="code"
            name="code"
            type="text"
            mono
            inputMode={mode === "backup" ? "text" : "numeric"}
            autoComplete="one-time-code"
            required
            disabled={!codeReady}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "code-error" : undefined}
            className="max-w-[140px]"
          />
        </FormField>

        {error && (
          <p id="code-error" className="type-sm text-(--state-danger)" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting || !codeReady} className="w-full">
          {submitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </div>
  );
}

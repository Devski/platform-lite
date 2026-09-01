"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

// Account-settings control for #29: turn on the easy e-mail codes, set up an
// authenticator app (manual key + backup codes, confirmed by a code), or turn
// two-factor off. Each state-changing call re-auths with the current password;
// on success we refresh so the server re-renders the new status.

type AppSetup = { key: string; backupCodes: string[] };

function mapError(
  t: (key: string) => string,
  status: number | undefined,
): string {
  if (status === 400) return t("errors.wrongPassword");
  if (status === 429) return t("errors.rateLimited");
  return t("errors.generic");
}

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const t = useTranslations("Settings.account.twoFactor");
  const router = useRouter();

  // E-mail OTP enrollment
  const [emailPassword, setEmailPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Authenticator (TOTP) enrollment
  const [appPassword, setAppPassword] = useState("");
  const [appBusy, setAppBusy] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [setup, setSetup] = useState<AppSetup | null>(null);
  const [appCode, setAppCode] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Disable
  const [offPassword, setOffPassword] = useState("");
  const [offBusy, setOffBusy] = useState(false);
  const [offError, setOffError] = useState<string | null>(null);

  async function enableEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    if (emailPassword.length === 0) {
      setEmailError(t("errors.passwordRequired"));
      return;
    }
    setEmailBusy(true);
    try {
      const { error } = await authClient.twoFactor.enable({
        password: emailPassword,
        method: "otp",
      });
      if (error) {
        setEmailError(mapError(t, error.status));
        return;
      }
      router.refresh();
    } catch {
      setEmailError(t("errors.generic"));
    } finally {
      setEmailBusy(false);
    }
  }

  async function startApp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppError(null);
    if (appPassword.length === 0) {
      setAppError(t("errors.passwordRequired"));
      return;
    }
    setAppBusy(true);
    try {
      const { data, error } = await authClient.twoFactor.enable({
        password: appPassword,
        method: "totp",
      });
      if (error || !data) {
        setAppError(mapError(t, error?.status));
        return;
      }
      const totp = data as { totpURI?: string; backupCodes?: string[] };
      const key = totp.totpURI
        ? (new URL(totp.totpURI).searchParams.get("secret") ?? "")
        : "";
      setSetup({ key, backupCodes: totp.backupCodes ?? [] });
      setAppPassword("");
    } catch {
      setAppError(t("errors.generic"));
    } finally {
      setAppBusy(false);
    }
  }

  async function confirmApp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmError(null);
    if (appCode.trim().length === 0) {
      setConfirmError(t("errors.codeRequired"));
      return;
    }
    setConfirmBusy(true);
    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code: appCode });
      if (error) {
        setConfirmError(
          error.status === 401
            ? t("errors.invalidCode")
            : t("errors.generic"),
        );
        return;
      }
      router.refresh();
    } catch {
      setConfirmError(t("errors.generic"));
    } finally {
      setConfirmBusy(false);
    }
  }

  async function disable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOffError(null);
    if (offPassword.length === 0) {
      setOffError(t("errors.passwordRequired"));
      return;
    }
    setOffBusy(true);
    try {
      const { error } = await authClient.twoFactor.disable({
        password: offPassword,
      });
      if (error) {
        setOffError(mapError(t, error.status));
        return;
      }
      router.refresh();
    } catch {
      setOffError(t("errors.generic"));
    } finally {
      setOffBusy(false);
    }
  }

  const inputClass =
    "rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none";
  const primaryButton =
    "self-start rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-gray-400";

  if (enabled) {
    return (
      <div className="mt-4 flex flex-col gap-4">
        <p className="text-sm text-green-700">{t("status.on")}</p>
        <form onSubmit={disable} noValidate className="flex flex-col gap-3">
          <label
            htmlFor="tf-off-password"
            className="text-sm font-medium text-gray-700"
          >
            {t("passwordLabel")}
          </label>
          <input
            id="tf-off-password"
            type="password"
            autoComplete="current-password"
            value={offPassword}
            onChange={(event) => setOffPassword(event.target.value)}
            className={inputClass}
          />
          {offError && (
            <p className="text-sm text-red-700" role="alert">
              {offError}
            </p>
          )}
          <button type="submit" disabled={offBusy} className={primaryButton}>
            {offBusy ? t("disable.disabling") : t("disable.button")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-6">
      <p className="text-sm text-gray-600">{t("status.off")}</p>

      <section className="flex flex-col gap-2 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {t("email.title")}
        </h3>
        <p className="text-sm text-gray-600">{t("email.description")}</p>
        <form onSubmit={enableEmail} noValidate className="flex flex-col gap-3">
          <label
            htmlFor="tf-email-password"
            className="text-sm font-medium text-gray-700"
          >
            {t("passwordLabel")}
          </label>
          <input
            id="tf-email-password"
            type="password"
            autoComplete="current-password"
            value={emailPassword}
            onChange={(event) => setEmailPassword(event.target.value)}
            className={inputClass}
          />
          {emailError && (
            <p className="text-sm text-red-700" role="alert">
              {emailError}
            </p>
          )}
          <button type="submit" disabled={emailBusy} className={primaryButton}>
            {emailBusy ? t("email.enabling") : t("email.enable")}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {t("app.title")}
        </h3>
        <p className="text-sm text-gray-600">{t("app.description")}</p>

        {!setup ? (
          <form onSubmit={startApp} noValidate className="flex flex-col gap-3">
            <label
              htmlFor="tf-app-password"
              className="text-sm font-medium text-gray-700"
            >
              {t("passwordLabel")}
            </label>
            <input
              id="tf-app-password"
              type="password"
              autoComplete="current-password"
              value={appPassword}
              onChange={(event) => setAppPassword(event.target.value)}
              className={inputClass}
            />
            {appError && (
              <p className="text-sm text-red-700" role="alert">
                {appError}
              </p>
            )}
            <button type="submit" disabled={appBusy} className={primaryButton}>
              {appBusy ? t("app.settingUp") : t("app.setup")}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-gray-600">{t("app.keyLabel")}</p>
              <code className="rounded-md bg-gray-100 px-3 py-2 text-sm break-all text-gray-900">
                {setup.key}
              </code>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-900">
                {t("app.backupTitle")}
              </p>
              <p className="text-sm text-gray-600">{t("app.backupNote")}</p>
              <ul className="grid grid-cols-2 gap-1 rounded-md bg-gray-100 px-3 py-2 font-mono text-sm text-gray-900">
                {setup.backupCodes.map((backupCode) => (
                  <li key={backupCode}>{backupCode}</li>
                ))}
              </ul>
            </div>
            <form onSubmit={confirmApp} noValidate className="flex flex-col gap-3">
              <label
                htmlFor="tf-app-code"
                className="text-sm font-medium text-gray-700"
              >
                {t("app.confirmLabel")}
              </label>
              <input
                id="tf-app-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={appCode}
                onChange={(event) => setAppCode(event.target.value)}
                className={inputClass}
              />
              {confirmError && (
                <p className="text-sm text-red-700" role="alert">
                  {confirmError}
                </p>
              )}
              <button
                type="submit"
                disabled={confirmBusy}
                className={primaryButton}
              >
                {confirmBusy ? t("app.activating") : t("app.activate")}
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}

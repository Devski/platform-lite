"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { FormField } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
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
  // After the confirming code succeeds we keep the backup codes on screen until
  // the user acknowledges — refreshing straight to the "on" view would wipe
  // the only copy of the recovery codes before they are saved.
  const [activated, setActivated] = useState(false);

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
      // Do NOT refresh yet — show the codes until the user clicks Done.
      setActivated(true);
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

  const heading = (
    <div className="flex items-center gap-(--sp-4)">
      <h2 className="type-h3 text-(--text-strong)">{t("heading")}</h2>
      <Badge uppercase tone={enabled ? "success" : "neutral"} className="ml-auto">
        {enabled ? t("status.badgeOn") : t("status.badgeOff")}
      </Badge>
    </div>
  );

  if (enabled) {
    return (
      <>
        {heading}
        <p className="mt-(--sp-4) type-sm text-(--state-success)">
          {t("status.on")}
        </p>
        <Divider className="mt-(--sp-4)" />
        <form onSubmit={disable} noValidate className="mt-(--sp-5) flex flex-col gap-(--sp-3)">
          <FormField label={t("passwordLabel")} htmlFor="tf-off-password">
            <Input
              id="tf-off-password"
              type="password"
              autoComplete="current-password"
              value={offPassword}
              onChange={(event) => setOffPassword(event.target.value)}
            />
          </FormField>
          {offError && (
            <p className="type-sm text-(--state-danger)" role="alert">
              {offError}
            </p>
          )}
          <Button type="submit" disabled={offBusy} className="self-start">
            {offBusy ? t("disable.disabling") : t("disable.button")}
          </Button>
        </form>
      </>
    );
  }

  // The authenticator is now active, but we hold on the backup codes so the
  // user can save them before the status view (which no longer shows them).
  if (activated && setup) {
    return (
      <>
        {heading}
        <p className="mt-(--sp-4) type-sm text-(--state-success)">
          {t("app.activatedHeading")}
        </p>
        <div className="mt-(--sp-4) flex flex-col gap-(--sp-1)">
          <p className="type-label text-(--text-strong)">{t("app.backupTitle")}</p>
          <p className="type-sm text-(--text-muted)">{t("app.backupNote")}</p>
          <ul className="grid grid-cols-2 gap-(--sp-1) rounded-md bg-(--surface-sunken) px-(--sp-4) py-(--sp-3) font-mono type-sm text-(--text-strong)">
            {setup.backupCodes.map((backupCode) => (
              <li key={backupCode}>{backupCode}</li>
            ))}
          </ul>
        </div>
        <Button type="button" onClick={() => router.refresh()} className="mt-(--sp-5) self-start">
          {t("app.done")}
        </Button>
      </>
    );
  }

  return (
    <>
      {heading}
      <p className="mt-(--sp-4) type-sm text-(--text-muted)">{t("status.off")}</p>
      <Divider className="mt-(--sp-4)" />

      <div className="mt-(--sp-5) flex items-start gap-(--sp-5)">
        <Icon name="mail" size={20} className="mt-(--sp-1) text-(--text-strong)" />
        <div className="flex-1">
          <h3 className="type-h4 text-(--text-strong)">{t("email.title")}</h3>
          <p className="mt-(--sp-2) type-sm text-(--text-muted)">
            {t("email.description")}
          </p>
          <form onSubmit={enableEmail} noValidate className="mt-(--sp-3) flex flex-col gap-(--sp-3)">
            <FormField label={t("passwordLabel")} htmlFor="tf-email-password">
              <Input
                id="tf-email-password"
                type="password"
                autoComplete="current-password"
                value={emailPassword}
                onChange={(event) => setEmailPassword(event.target.value)}
              />
            </FormField>
            {emailError && (
              <p className="type-sm text-(--state-danger)" role="alert">
                {emailError}
              </p>
            )}
            <Button type="submit" variant="quiet" disabled={emailBusy} className="self-start">
              {emailBusy ? t("email.enabling") : t("email.enable")}
            </Button>
          </form>
        </div>
      </div>

      <Divider className="mt-(--sp-6)" />

      <div className="mt-(--sp-5) flex items-start gap-(--sp-5)">
        <Icon name="smartphone" size={20} className="mt-(--sp-1) text-(--text-strong)" />
        <div className="flex-1">
          <h3 className="type-h4 text-(--text-strong)">{t("app.title")}</h3>
          <p className="mt-(--sp-2) type-sm text-(--text-muted)">
            {t("app.description")}
          </p>

          {!setup ? (
            <form onSubmit={startApp} noValidate className="mt-(--sp-3) flex flex-col gap-(--sp-3)">
              <FormField label={t("passwordLabel")} htmlFor="tf-app-password">
                <Input
                  id="tf-app-password"
                  type="password"
                  autoComplete="current-password"
                  value={appPassword}
                  onChange={(event) => setAppPassword(event.target.value)}
                />
              </FormField>
              {appError && (
                <p className="type-sm text-(--state-danger)" role="alert">
                  {appError}
                </p>
              )}
              <Button type="submit" variant="quiet" disabled={appBusy} className="self-start">
                {appBusy ? t("app.settingUp") : t("app.setup")}
              </Button>
            </form>
          ) : (
            <div className="mt-(--sp-3) flex flex-col gap-(--sp-3)">
              <div className="flex flex-col gap-(--sp-1)">
                <p className="type-sm text-(--text-muted)">{t("app.keyLabel")}</p>
                <code className="rounded-md bg-(--surface-sunken) px-(--sp-4) py-(--sp-3) type-sm break-all text-(--text-strong)">
                  {setup.key}
                </code>
              </div>
              <div className="flex flex-col gap-(--sp-1)">
                <p className="type-label text-(--text-strong)">
                  {t("app.backupTitle")}
                </p>
                <p className="type-sm text-(--text-muted)">{t("app.backupNote")}</p>
                <ul className="grid grid-cols-2 gap-(--sp-1) rounded-md bg-(--surface-sunken) px-(--sp-4) py-(--sp-3) font-mono type-sm text-(--text-strong)">
                  {setup.backupCodes.map((backupCode) => (
                    <li key={backupCode}>{backupCode}</li>
                  ))}
                </ul>
              </div>
              <form onSubmit={confirmApp} noValidate className="flex flex-col gap-(--sp-3)">
                <FormField label={t("app.confirmLabel")} htmlFor="tf-app-code">
                  <Input
                    id="tf-app-code"
                    type="text"
                    mono
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={appCode}
                    onChange={(event) => setAppCode(event.target.value)}
                    className="max-w-[140px]"
                  />
                </FormField>
                {confirmError && (
                  <p className="type-sm text-(--state-danger)" role="alert">
                    {confirmError}
                  </p>
                )}
                <Button type="submit" disabled={confirmBusy} className="self-start">
                  {confirmBusy ? t("app.activating") : t("app.activate")}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

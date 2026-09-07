"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { TextLink, textButtonClassName } from "@/components/ui/text-link";
import { authClient } from "@/lib/auth-client";
import { emailSchema } from "@/lib/auth-schemas";
import { ResendStatus } from "../resend-status";
import { AUTH_SUBMIT, AUTH_TOUCH } from "../shell";
import { useResendVerification } from "../use-resend-verification";

type FieldErrors = { email?: string; password?: string };

export function LoginForm() {
  const t = useTranslations("Login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notVerifiedFor, setNotVerifiedFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    state: resendState,
    resend,
    reset: resetResend,
  } = useResendVerification();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotVerifiedFor(null);
    resetResend();

    const parsedEmail = emailSchema.safeParse(email);
    const errors: FieldErrors = {};
    if (!parsedEmail.success) errors.email = t("errors.emailInvalid");
    // No length rules here — the stored password decides, not the form (A1
    // bounds apply at registration only).
    if (password.length === 0) errors.password = t("errors.passwordRequired");
    setFieldErrors(errors);
    if (!parsedEmail.success || password.length === 0) return;

    setSubmitting(true);
    try {
      const { data, error } = await authClient.signIn.email({
        email: parsedEmail.data,
        password,
      });
      if (!error) {
        // #29: a 2FA-enabled account gets no session yet — the server asks for
        // the second factor. The redirect fields ride the sign-in payload but
        // aren't in the client's inferred success type, so narrow explicitly.
        const challenge = data as {
          twoFactorRedirect?: boolean;
          twoFactorMethods?: string[];
        } | null;
        if (challenge?.twoFactorRedirect) {
          // Carry the offered methods in the URL so the challenge page renders
          // them server-side (which factors the user actually has). Not
          // sensitive, and the server enforces what it accepts regardless.
          const methods = Array.isArray(challenge.twoFactorMethods)
            ? challenge.twoFactorMethods.join(",")
            : "";
          router.push(`/two-factor?methods=${encodeURIComponent(methods)}`);
          return;
        }
        // #15: land on the onboarding step — it forwards users who already
        // have a handle to /.
        router.push("/onboarding");
        return;
      }
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setNotVerifiedFor(parsedEmail.data);
      } else if (error.status === 429) {
        setFormError(t("errors.rateLimited"));
      } else if (error.status === 401) {
        setFormError(t("errors.invalidCredentials"));
      } else {
        setFormError(t("errors.generic"));
      }
    } catch {
      // Network-level failure: the client rethrows when no response arrived.
      setFormError(t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-(--sp-7) flex flex-col gap-(--sp-5)"
    >
      <FormField label={t("emailLabel")} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
        {fieldErrors.email && (
          <p id="email-error" className="type-sm text-(--state-danger)">
            {fieldErrors.email}
          </p>
        )}
      </FormField>

      <FormField label={t("passwordLabel")} htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
        />
        {fieldErrors.password && (
          <p id="password-error" className="type-sm text-(--state-danger)">
            {fieldErrors.password}
          </p>
        )}
      </FormField>

      {formError && (
        <p className="type-sm text-(--state-danger)" role="alert">
          {formError}
        </p>
      )}

      {notVerifiedFor && (
        <div className="flex flex-col gap-(--sp-2)" role="alert">
          <p className="type-sm text-(--state-danger)">
            {t("errors.notVerified")}
          </p>
          <button
            type="button"
            onClick={() => resend(notVerifiedFor)}
            disabled={resendState === "sending"}
            className={textButtonClassName(
              "default",
              `self-start ${AUTH_TOUCH}`,
            )}
          >
            {resendState === "sending" ? t("resending") : t("resend")}
          </button>
          <ResendStatus
            state={resendState}
            done={t("resendDone")}
            limited={t("resendLimited")}
            failed={t("resendFailed")}
          />
        </div>
      )}

      <Button type="submit" disabled={submitting} className={AUTH_SUBMIT}>
        {submitting ? t("submitting") : t("submit")}
      </Button>

      <TextLink href="/reset-password" tone="muted" className="self-start">
        {t("forgotPassword")}
      </TextLink>
    </form>
  );
}

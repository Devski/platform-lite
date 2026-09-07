"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { getPathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { textButtonClassName } from "@/components/ui/text-link";
import { REGISTRATION_NAME } from "@/lib/account";
import { authClient } from "@/lib/auth-client";
import { PASSWORD_MAX, PASSWORD_MIN, signUpSchema } from "@/lib/auth-schemas";
import { ResendStatus } from "../resend-status";
import { useResendVerification } from "../use-resend-verification";

type FieldErrors = { email?: string; password?: string };

export function RegisterForm() {
  const t = useTranslations("Register");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { state: resendState, resend } = useResendVerification();

  // Localized landing page for the e-mail link (A8: pl unprefixed, /en/...).
  const callbackURL = getPathname({ locale, href: "/register/verified" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = signUpSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "email" && !errors.email) {
          errors.email = t("errors.emailInvalid");
        }
        if (issue.path[0] === "password" && !errors.password) {
          errors.password =
            issue.code === "too_big"
              ? t("errors.passwordTooLong", { max: PASSWORD_MAX })
              : t("errors.passwordTooShort", { min: PASSWORD_MIN });
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const { error } = await authClient.signUp.email({
        email: parsed.data.email,
        password: parsed.data.password,
        // Better Auth requires the field, not a value (`z.string()`, no
        // nonempty). Deliberately EMPTY: it used to hold the e-mail local
        // part, which then became the display name and the proposed
        // address, publishing the account's own address on a public page
        // and in every shared link (#36). The real name is asked for in
        // onboarding, where the address is derived from it.
        name: REGISTRATION_NAME,
        callbackURL,
      });
      if (error) {
        setFormError(
          error.status === 429 ? t("errors.rateLimited") : t("errors.generic"),
        );
        return;
      }
      setSentTo(parsed.data.email);
    } catch {
      // Network-level failure: the client rethrows when no response arrived.
      setFormError(t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <div className="mt-(--sp-6) flex flex-col gap-(--sp-5)">
        <h2 className="type-h4 text-(--text-strong)">{t("sent.heading")}</h2>
        <p className="type-sm text-(--text-muted)">
          {t("sent.body", { email: sentTo })}
        </p>
        <button
          type="button"
          onClick={() => resend(sentTo)}
          disabled={resendState === "sending"}
          className={textButtonClassName("default", "self-start")}
        >
          {resendState === "sending" ? t("sent.resending") : t("sent.resend")}
        </button>
        <ResendStatus
          state={resendState}
          done={t("sent.resendDone")}
          limited={t("sent.resendLimited")}
          failed={t("sent.resendFailed")}
        />
      </div>
    );
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

      <FormField
        label={t("passwordLabel")}
        htmlFor="password"
        hint={
          !fieldErrors.password &&
          t("passwordHint", { min: PASSWORD_MIN, max: PASSWORD_MAX })
        }
        hintId="password-hint"
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={
            fieldErrors.password ? "password-error" : "password-hint"
          }
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

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}

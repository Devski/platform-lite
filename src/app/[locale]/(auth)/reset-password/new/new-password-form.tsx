"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";
import { authClient } from "@/lib/auth-client";
import { PASSWORD_MAX, PASSWORD_MIN, passwordSchema } from "@/lib/auth-schemas";

export function NewPasswordForm({ token }: { token: string }) {
  const t = useTranslations("ResetPassword.new");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<"form" | "done" | "invalidToken">(
    "form",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setFieldError(
        parsed.error.issues[0]?.code === "too_big"
          ? t("errors.passwordTooLong", { max: PASSWORD_MAX })
          : t("errors.passwordTooShort", { min: PASSWORD_MIN }),
      );
      return;
    }
    setFieldError(null);

    setSubmitting(true);
    try {
      const { error } = await authClient.resetPassword({
        newPassword: parsed.data,
        token,
      });
      if (!error) {
        setOutcome("done");
        return;
      }
      if (error.code === "INVALID_TOKEN") {
        // The single-use token died between opening the page and submitting
        // (expired, or consumed elsewhere) — only a fresh link can help.
        setOutcome("invalidToken");
      } else {
        setFormError(
          error.status === 429 ? t("errors.rateLimited") : t("errors.generic"),
        );
      }
    } catch {
      // Network-level failure: the client rethrows when no response arrived.
      setFormError(t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome === "done") {
    return (
      <div className="mt-(--sp-6) flex flex-col gap-(--sp-5)">
        <h2 className="type-h4 text-(--text-strong)">{t("success.heading")}</h2>
        <p className="type-sm text-(--text-muted)">{t("success.body")}</p>
        <TextLink href="/login" className="self-start">
          {t("success.loginLink")}
        </TextLink>
      </div>
    );
  }

  if (outcome === "invalidToken") {
    return (
      <div className="mt-(--sp-6) flex flex-col gap-(--sp-5)" role="alert">
        <p className="type-sm text-(--state-danger)">{t("invalid.body")}</p>
        <TextLink href="/reset-password" className="self-start">
          {t("invalid.requestLink")}
        </TextLink>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-(--sp-7) flex flex-col gap-(--sp-5)"
    >
      <FormField
        label={t("passwordLabel")}
        htmlFor="password"
        hint={
          !fieldError &&
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
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "password-error" : "password-hint"}
        />
        {fieldError && (
          <p id="password-error" className="type-sm text-(--state-danger)">
            {fieldError}
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

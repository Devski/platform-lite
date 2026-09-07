"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { PASSWORD_MAX, PASSWORD_MIN, passwordSchema } from "@/lib/auth-schemas";

type FieldErrors = { current?: string; next?: string };

export function ChangePasswordForm() {
  const t = useTranslations("Settings.account.password");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setDone(false);

    const errors: FieldErrors = {};
    // The stored password decides what the current one looks like — only
    // presence is checked here (same stance as the login form).
    if (currentPassword.length === 0) errors.current = t("errors.currentRequired");
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      errors.next =
        parsed.error.issues[0]?.code === "too_big"
          ? t("errors.passwordTooLong", { max: PASSWORD_MAX })
          : t("errors.passwordTooShort", { min: PASSWORD_MIN });
    }
    setFieldErrors(errors);
    if (errors.current || errors.next) return;

    setSubmitting(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword: parsed.data!,
        // Decision of 01.09.2026: a password change signs out every other
        // device; this session continues on the fresh token the server sets.
        revokeOtherSessions: true,
      });
      if (!error) {
        setDone(true);
        setCurrentPassword("");
        setNewPassword("");
        return;
      }
      if (error.code === "INVALID_PASSWORD") {
        setFieldErrors({ current: t("errors.wrongCurrent") });
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

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-(--sp-5) flex flex-col gap-(--sp-5)"
    >
      <FormField label={t("currentLabel")} htmlFor="current-password">
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          aria-invalid={fieldErrors.current ? true : undefined}
          aria-describedby={
            fieldErrors.current ? "current-password-error" : undefined
          }
        />
        {fieldErrors.current && (
          <p id="current-password-error" className="type-sm text-(--state-danger)">
            {fieldErrors.current}
          </p>
        )}
      </FormField>

      <FormField
        label={t("newLabel")}
        htmlFor="new-password"
        hint={!fieldErrors.next && t("newHint", { min: PASSWORD_MIN, max: PASSWORD_MAX })}
        hintId="new-password-hint"
      >
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          aria-invalid={fieldErrors.next ? true : undefined}
          aria-describedby={
            fieldErrors.next ? "new-password-error" : "new-password-hint"
          }
        />
        {fieldErrors.next && (
          <p id="new-password-error" className="type-sm text-(--state-danger)">
            {fieldErrors.next}
          </p>
        )}
      </FormField>

      {formError && (
        <p className="type-sm text-(--state-danger)" role="alert">
          {formError}
        </p>
      )}
      {done && (
        <p className="type-sm text-(--state-success)" role="status">
          {t("done")}
        </p>
      )}

      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}

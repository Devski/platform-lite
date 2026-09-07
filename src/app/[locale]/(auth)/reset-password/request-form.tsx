"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { getPathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { emailSchema } from "@/lib/auth-schemas";

export function RequestForm() {
  const t = useTranslations("ResetPassword.request");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Localized landing page for the e-mail link (A8: pl unprefixed, /en/...).
  const redirectTo = getPathname({ locale, href: "/reset-password/new" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(t("errors.emailInvalid"));
      return;
    }
    setFieldError(null);

    setSubmitting(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email: parsed.data,
        redirectTo,
      });
      if (error) {
        setFormError(
          error.status === 429 ? t("errors.rateLimited") : t("errors.generic"),
        );
        return;
      }
      // 200 whether or not the address exists (enumeration protection), so
      // this only ever means "request accepted" — the copy says as much.
      setSentTo(parsed.data);
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
      </div>
    );
  }

  return (
    <>
      <p className="mt-(--sp-3) type-sm text-(--text-muted)">{t("body")}</p>

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
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "email-error" : undefined}
          />
          {fieldError && (
            <p id="email-error" className="type-sm text-(--state-danger)">
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
    </>
  );
}

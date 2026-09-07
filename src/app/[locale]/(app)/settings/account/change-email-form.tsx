"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { getPathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { emailSchema } from "@/lib/auth-schemas";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const t = useTranslations("Settings.account.email");
  const locale = useLocale();
  const [newEmail, setNewEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Localized landing page for the confirmation link (A8).
  const callbackURL = getPathname({ locale, href: "/email-changed" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) {
      setFieldError(t("errors.emailInvalid"));
      return;
    }
    if (parsed.data === currentEmail.toLowerCase()) {
      setFieldError(t("errors.sameEmail"));
      return;
    }
    setFieldError(null);

    setSubmitting(true);
    try {
      const { error } = await authClient.changeEmail({
        newEmail: parsed.data,
        callbackURL,
      });
      if (error) {
        setFormError(
          error.status === 429 ? t("errors.rateLimited") : t("errors.generic"),
        );
        return;
      }
      // 200 whether or not the address is free (enumeration protection), so
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
      <div className="mt-(--sp-5) flex flex-col gap-(--sp-2)">
        <h3 className="type-h4 text-(--text-strong)">{t("sent.heading")}</h3>
        <p className="type-sm text-(--text-muted)">
          {t("sent.body", { email: sentTo })}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-(--sp-5) flex flex-col gap-(--sp-5)"
    >
      <FormField label={t("newLabel")} htmlFor="new-email">
        <Input
          id="new-email"
          name="newEmail"
          type="email"
          autoComplete="email"
          required
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "new-email-error" : undefined}
        />
        {fieldError && (
          <p id="new-email-error" className="type-sm text-(--state-danger)">
            {fieldError}
          </p>
        )}
      </FormField>

      {formError && (
        <p className="type-sm text-(--state-danger)" role="alert">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}

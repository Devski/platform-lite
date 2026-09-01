"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { getPathname } from "@/i18n/navigation";
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
      <div className="mt-4 flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          {t("sent.heading")}
        </h3>
        <p className="text-sm text-gray-600">
          {t("sent.body", { email: sentTo })}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-4 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="new-email" className="text-sm font-medium text-gray-700">
          {t("newLabel")}
        </label>
        <input
          id="new-email"
          name="newEmail"
          type="email"
          autoComplete="email"
          required
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "new-email-error" : undefined}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
        />
        {fieldError && (
          <p id="new-email-error" className="text-sm text-red-700">
            {fieldError}
          </p>
        )}
      </div>

      {formError && (
        <p className="text-sm text-red-700" role="alert">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-gray-400"
      >
        {submitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}

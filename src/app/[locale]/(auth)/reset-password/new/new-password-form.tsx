"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
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
      <div className="mt-4 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("success.heading")}
        </h2>
        <p className="text-sm text-gray-600">{t("success.body")}</p>
        <Link
          href="/login"
          className="text-sm font-semibold text-blue-700 hover:underline"
        >
          {t("success.loginLink")}
        </Link>
      </div>
    );
  }

  if (outcome === "invalidToken") {
    return (
      <div className="mt-4 flex flex-col gap-4" role="alert">
        <p className="text-sm text-red-700">{t("invalid.body")}</p>
        <Link
          href="/reset-password"
          className="text-sm font-semibold text-blue-700 hover:underline"
        >
          {t("invalid.requestLink")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-6 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-gray-700">
          {t("passwordLabel")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "password-error" : "password-hint"}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
        />
        {fieldError ? (
          <p id="password-error" className="text-sm text-red-700">
            {fieldError}
          </p>
        ) : (
          <p id="password-hint" className="text-sm text-gray-500">
            {t("passwordHint", { min: PASSWORD_MIN, max: PASSWORD_MAX })}
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
        className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-gray-400"
      >
        {submitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}

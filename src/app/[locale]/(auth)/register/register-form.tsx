"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { getPathname } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { PASSWORD_MAX, PASSWORD_MIN, signUpSchema } from "@/lib/auth-schemas";

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
  const [resendState, setResendState] = useState<
    "idle" | "sending" | "done" | "limited"
  >("idle");

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
    const { error } = await authClient.signUp.email({
      email: parsed.data.email,
      password: parsed.data.password,
      // Better Auth requires a name; the real display identity lives in
      // profiles (#14). Seed it from the address's local part.
      name: parsed.data.email.split("@")[0],
      callbackURL,
    });
    setSubmitting(false);

    if (error) {
      setFormError(
        error.status === 429 ? t("errors.rateLimited") : t("errors.generic"),
      );
      return;
    }
    setSentTo(parsed.data.email);
  }

  async function handleResend() {
    if (!sentTo) return;
    setResendState("sending");
    const { error } = await authClient.sendVerificationEmail({
      email: sentTo,
      callbackURL,
    });
    setResendState(error ? (error.status === 429 ? "limited" : "idle") : "done");
  }

  if (sentTo) {
    return (
      <div className="mt-4 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("sent.heading")}
        </h2>
        <p className="text-sm text-gray-600">
          {t("sent.body", { email: sentTo })}
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendState === "sending"}
          className="self-start text-sm font-semibold text-blue-700 hover:underline disabled:text-gray-400"
        >
          {resendState === "sending" ? t("sent.resending") : t("sent.resend")}
        </button>
        {resendState === "done" && (
          <p className="text-sm text-green-700" role="status">
            {t("sent.resendDone")}
          </p>
        )}
        {resendState === "limited" && (
          <p className="text-sm text-red-700" role="status">
            {t("sent.resendLimited")}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          {t("emailLabel")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
        />
        {fieldErrors.email && (
          <p id="email-error" className="text-sm text-red-700">
            {fieldErrors.email}
          </p>
        )}
      </div>

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
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={
            fieldErrors.password ? "password-error" : "password-hint"
          }
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
        />
        {fieldErrors.password ? (
          <p id="password-error" className="text-sm text-red-700">
            {fieldErrors.password}
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

"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { emailSchema } from "@/lib/auth-schemas";
import { useResendVerification } from "../../use-resend-verification";

// Requests a fresh verification link when the one from the e-mail was
// rejected. The endpoint answers 200 whether or not the address exists
// (enumeration protection), so the done-state copy stays unconditional.
export function ResendForm() {
  const t = useTranslations("Register.verified");
  const tErrors = useTranslations("Register.errors");
  const tRegister = useTranslations("Register");
  const [email, setEmail] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const { state, resend } = useResendVerification();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setValidationError(tErrors("emailInvalid"));
      return;
    }
    setValidationError(null);
    await resend(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <label htmlFor="resend-email" className="text-sm font-medium text-gray-700">
        {tRegister("emailLabel")}
      </label>
      <input
        id="resend-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-invalid={validationError ? true : undefined}
        aria-describedby={validationError ? "resend-email-error" : undefined}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
      />
      {validationError && (
        <p id="resend-email-error" className="text-sm text-red-700">
          {validationError}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-gray-400"
      >
        {state === "sending" ? t("resendSending") : t("resendSubmit")}
      </button>
      {state === "done" && (
        <p className="text-sm text-green-700" role="status">
          {t("resendDone")}
        </p>
      )}
      {state === "limited" && (
        <p className="text-sm text-red-700" role="status">
          {t("resendLimited")}
        </p>
      )}
      {state === "failed" && (
        <p className="text-sm text-red-700" role="status">
          {t("resendFailed")}
        </p>
      )}
    </form>
  );
}

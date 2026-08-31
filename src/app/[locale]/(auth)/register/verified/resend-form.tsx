"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { getPathname } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { emailSchema } from "@/lib/auth-schemas";

// Requests a fresh verification link when the one from the e-mail was
// rejected. The endpoint answers 200 whether or not the address exists
// (enumeration protection), so the done-state copy stays unconditional.
export function ResendForm() {
  const t = useTranslations("Register.verified");
  const tErrors = useTranslations("Register.errors");
  const tRegister = useTranslations("Register");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done" | "limited">(
    "idle",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(tErrors("emailInvalid"));
      return;
    }

    setState("sending");
    try {
      const { error: requestError } = await authClient.sendVerificationEmail({
        email: parsed.data,
        callbackURL: getPathname({ locale, href: "/register/verified" }),
      });
      if (!requestError) {
        setState("done");
        return;
      }
      if (requestError.status === 429) {
        setState("limited");
        return;
      }
    } catch {
      // Network-level failure — fall through to the generic feedback below.
    }
    setState("idle");
    setError(tErrors("generic"));
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
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "resend-email-error" : undefined}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
      />
      {error && (
        <p id="resend-email-error" className="text-sm text-red-700">
          {error}
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
    </form>
  );
}

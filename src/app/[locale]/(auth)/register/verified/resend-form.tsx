"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { emailSchema } from "@/lib/auth-schemas";
import { ResendStatus } from "../../resend-status";
import { AUTH_SUBMIT } from "../../shell";
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
  const { state, resend, reset } = useResendVerification();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      // Also drop any previous outcome — a stale "sent" next to a fresh
      // validation error would talk about a different address.
      reset();
      setValidationError(tErrors("emailInvalid"));
      return;
    }
    setValidationError(null);
    await resend(parsed.data);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-(--sp-7) flex flex-col gap-(--sp-5)"
    >
      <FormField label={tRegister("emailLabel")} htmlFor="resend-email">
        <Input
          id="resend-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={validationError ? true : undefined}
          aria-describedby={validationError ? "resend-email-error" : undefined}
        />
        {validationError && (
          <p id="resend-email-error" className="type-sm text-(--state-danger)">
            {validationError}
          </p>
        )}
      </FormField>

      <Button
        type="submit"
        disabled={state === "sending"}
        className={AUTH_SUBMIT}
      >
        {state === "sending" ? t("resendSending") : t("resendSubmit")}
      </Button>

      <ResendStatus
        state={state}
        done={t("resendDone")}
        limited={t("resendLimited")}
        failed={t("resendFailed")}
      />
    </form>
  );
}

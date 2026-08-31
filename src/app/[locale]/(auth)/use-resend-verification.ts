"use client";

import { useLocale } from "next-intl";
import { useState } from "react";
import { getPathname } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export type ResendState = "idle" | "sending" | "done" | "limited" | "failed";

// One resend flow for every place that offers it (registration inbox state,
// the verification landing page, the unverified-login error). The endpoint
// answers 200 whether or not the address exists (enumeration protection),
// so "done" only ever means "request accepted".
export function useResendVerification() {
  const locale = useLocale();
  const [state, setState] = useState<ResendState>("idle");

  async function resend(email: string): Promise<void> {
    setState("sending");
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: getPathname({ locale, href: "/register/verified" }),
      });
      if (!error) {
        setState("done");
        return;
      }
      setState(error.status === 429 ? "limited" : "failed");
    } catch {
      // Network-level failure: the client rethrows when no response arrived.
      setState("failed");
    }
  }

  return { state, resend };
}

"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

// The panel sits on the landing page's white block under the photo (A11,
// decision of 06.09.2026), so every state is styled for a light ground.
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
// blue-700, like the rest of the light pages: the fill is the only thing
// marking this as a button, and WCAG 1.4.11 wants 3:1 for it against its own
// ground — on white blue-700 measures 6.31:1 — while the white label inside
// needs 4.5:1 against the fill. The hover must go darker here, not lighter,
// or the label falls under that line.
const PRIMARY_BUTTON = `rounded-full bg-blue-700 px-6 py-3 text-center text-base font-semibold text-white hover:bg-blue-800 ${FOCUS_RING}`;
const SECONDARY_BUTTON = `rounded-full border border-gray-500 px-6 py-3 text-center text-base font-semibold text-gray-900 hover:bg-gray-50 ${FOCUS_RING}`;
const TEXT_LINK = `font-semibold text-gray-900 underline hover:no-underline ${FOCUS_RING}`;

// Client-side on purpose: the homepage stays statically prerendered (and the
// DB-less e2e job keeps working) while the session is fetched in the browser.
// A failed /get-session — no environment, no database — renders as signed out.
export function SessionPanel() {
  const t = useTranslations("Session");
  const { data } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      const { error } = await authClient.signOut();
      if (error) setSignOutFailed(true);
      // On success useSession refetches via the client's session signal and
      // this panel flips to the signed-out links by itself.
    } catch {
      setSignOutFailed(true);
    } finally {
      setSigningOut(false);
    }
  }

  // The signed-out links are the default view, shown from the first paint
  // (most visitors are signed out — A11 makes them the entry point) and while
  // the session is still loading; a signed-in visitor sees a brief flip once
  // the session arrives. This also keeps the panel instant when the backend
  // is unreachable.
  if (!data) {
    return (
      // Rendered as buttons rather than a row of text, sign-up first: on a
      // landing page this pair is the only thing to do, so it carries the
      // page's visual weight.
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Link href="/register" className={PRIMARY_BUTTON}>
          {t("register")}
        </Link>
        <Link href="/login" className={SECONDARY_BUTTON}>
          {t("logIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-3">
        <span className="text-gray-600">
          {t("signedInAs", { email: data.user.email })}
        </span>
        <Link href="/settings/account" className={TEXT_LINK}>
          {t("settings")}
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className={`${TEXT_LINK} disabled:text-gray-500 disabled:no-underline`}
        >
          {signingOut ? t("loggingOut") : t("logOut")}
        </button>
      </div>
      {signOutFailed && (
        <p className="text-sm text-red-700" role="status">
          {t("error")}
        </p>
      )}
    </div>
  );
}

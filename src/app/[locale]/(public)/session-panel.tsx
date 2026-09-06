"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { FOCUS_RING } from "./focus-ring";

// The panel sits on the landing page's white card, on the photograph (A11,
// decision of 06.09.2026), so every state is styled for a light ground.
//
// Monochrome, on Dawid's instruction the same day: black, grey and white, no
// blue. gray-900 on white is 17.8:1, far past the 3:1 that WCAG 1.4.11 asks of
// the only thing marking this as a button, and the white label inside clears
// 4.5:1 comfortably. The rest of the app is still blue — this is the landing
// page alone, and the two will have to be reconciled.
//
// Pill and size are also the landing page's alone (every other button in src/
// is a small rounded-md), because this pair is the whole point of the page.
const PRIMARY_BUTTON = `rounded-full bg-gray-900 px-6 py-3 text-center text-base font-semibold text-white hover:bg-gray-700 ${FOCUS_RING}`;
// border-gray-500, not the border-gray-300 used elsewhere: the border is the
// only thing marking this control, and gray-300 on white is 1.75:1, well under
// the 3:1 of WCAG 1.4.11 — gray-500 is 4.84:1. gray-100 on hover, because
// gray-50 is 1.04:1 against white: a hover state nobody can see.
const SECONDARY_BUTTON = `rounded-full border border-gray-500 px-6 py-3 text-center text-base font-semibold text-gray-900 hover:border-gray-900 hover:bg-gray-100 ${FOCUS_RING}`;
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

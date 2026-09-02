"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

// The panel sits on the landing photo (A11), so every state is styled for a
// dark ground: white text, an explicit focus ring the browser default cannot
// provide over an arbitrary image.
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
// blue-600, not the blue-700 the light pages use: the fill is the only thing
// marking this as a button, and WCAG 1.4.11 wants 3:1 against its ground. On
// the near-black card blue-700 measures 2.95:1, blue-600 3.74:1 — and the
// hover must go lighter, not darker, or it falls back under the line.
const PRIMARY_BUTTON = `rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 ${FOCUS_RING}`;
const SECONDARY_BUTTON = `rounded-md border border-white/60 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 ${FOCUS_RING}`;
const TEXT_LINK = `font-semibold text-white underline hover:no-underline ${FOCUS_RING}`;

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
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
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
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-col items-center gap-2 text-sm sm:flex-row sm:gap-3">
        <span className="text-gray-200">
          {t("signedInAs", { email: data.user.email })}
        </span>
        <Link href="/settings/account" className={TEXT_LINK}>
          {t("settings")}
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className={`${TEXT_LINK} disabled:text-gray-400 disabled:no-underline`}
        >
          {signingOut ? t("loggingOut") : t("logOut")}
        </button>
      </div>
      {signOutFailed && (
        <p className="text-sm text-red-200" role="status">
          {t("error")}
        </p>
      )}
    </div>
  );
}

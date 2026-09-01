"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

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
      <div className="flex gap-3 text-sm">
        <Link
          href="/login"
          className="font-semibold text-blue-700 hover:underline"
        >
          {t("logIn")}
        </Link>
        <Link
          href="/register"
          className="font-semibold text-blue-700 hover:underline"
        >
          {t("register")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-600">
          {t("signedInAs", { email: data.user.email })}
        </span>
        <Link
          href="/settings/account"
          className="font-semibold text-blue-700 hover:underline"
        >
          {t("settings")}
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="font-semibold text-blue-700 hover:underline disabled:text-gray-400"
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

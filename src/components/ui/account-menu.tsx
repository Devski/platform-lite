"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "./avatar";
import { Divider } from "./divider";
import { Icon } from "./icon";
import { useDismissable } from "./use-dismissable";

// The avatar in the top bar (30px, matching the mark's height), clickable
// into a three-item menu: Profil, Konto, Wyloguj (design-system-source,
// screens 6/7).
export function AccountMenu({
  handle,
  avatarUrl,
  displayName,
}: {
  handle: string;
  avatarUrl: string | null;
  displayName: string;
}) {
  const t = useTranslations("AccountMenu");
  const tSession = useTranslations("Session");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismissable(open, containerRef, () => setOpen(false));

  async function handleLogOut() {
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        setSignOutFailed(true);
        return;
      }
      router.push("/");
    } catch {
      setSignOutFailed(true);
    } finally {
      setSigningOut(false);
    }
  }

  const itemClass =
    "flex items-center gap-(--sp-3) rounded-sm px-(--sp-4) py-(--sp-3) type-sm text-(--text-body) hover:bg-(--surface-hover)";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("menuLabel")}
        title={t("menuLabel")}
        className="block rounded-full focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
      >
        <Avatar src={avatarUrl} name={displayName} size={30} />
      </button>
      {open && (
        <nav
          role="menu"
          aria-label={t("menuLabel")}
          className="absolute top-full right-0 z-10 mt-(--sp-2) w-[170px] rounded-md border border-(--border-default) bg-(--surface-card) p-(--sp-2) shadow-md"
        >
          <Link
            href={`/${handle}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <Icon name="user" size={16} />
            {t("profile")}
          </Link>
          <Link
            href="/settings/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <Icon name="settings" size={16} />
            {t("account")}
          </Link>
          <Divider className="my-(--sp-2)" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogOut}
            disabled={signingOut}
            className={`${itemClass} disabled:text-(--text-subtle)`}
          >
            <Icon name="log-out" size={16} />
            {signingOut ? tSession("loggingOut") : tSession("logOut")}
          </button>
          {signOutFailed && (
            <p className="px-(--sp-4) py-(--sp-2) type-sm text-(--state-danger)" role="alert">
              {tSession("error")}
            </p>
          )}
        </nav>
      )}
    </div>
  );
}

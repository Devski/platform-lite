import { getTranslations } from "next-intl/server";
import type { ComponentPropsWithoutRef } from "react";
import { Link } from "@/i18n/navigation";
import { LogoMark } from "./logo-mark";

type LogoProps = {
  href: ComponentPropsWithoutRef<typeof Link>["href"];
  onPhoto?: boolean;
  size?: "default" | "compact";
};

// Mark + wordmark, clickable everywhere: to the hero for a signed-out
// visitor, to the visitor's own public profile once signed in (the hero is
// unreachable once logged in) — callers pass the right href for the page
// they're on. A server component (like every page that renders it) so it
// can use getTranslations directly, matching this codebase's convention.
export async function Logo({ href, onPhoto = false, size = "default" }: LogoProps) {
  const t = await getTranslations("Brand");
  const wordmark = t("wordmark");
  return <LogoMark href={href} wordmark={wordmark} onPhoto={onPhoto} size={size} />;
}

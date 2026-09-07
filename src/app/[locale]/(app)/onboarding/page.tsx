import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDb } from "@/db/client";
import { getAuth } from "@/lib/auth";
import { appOrigin } from "@/lib/env";
import { getHandleState, suggestHandle } from "@/lib/profile-handle";
import { OnboardingSteps } from "./onboarding-steps";

// #15: the one step between login and the app. Login and the 2FA challenge
// land here; a user who already has a handle is forwarded straight to their
// profile, everyone else picks one (a proposal is prefilled). Deliberately
// its own page, not a settings section: the address is the point of the
// product (§1), so it comes before the name and the photo.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Onboarding" });
  return { title: t("title") };
}

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The (app) layout already gated the render; the re-fetch supplies the
  // user id and covers the layout-less edge, as the settings pages do.
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    // redirect() throws; the return only narrows the type below.
    redirect({ href: "/login", locale });
    return null;
  }
  const db = getDb();
  const state = await getHandleState(db, session.user.id);
  if (state.handle) {
    // Straight to the profile that's already set up — "/" now redirects
    // signed-in visitors right back here, so going through it would just add
    // a hop.
    redirect({ href: `/${state.handle}`, locale });
    return null;
  }
  const suggestion = await suggestHandle(db, session.user.id);

  return (
    <main className="flex min-h-screen items-center justify-center bg-(--surface-page) p-(--sp-7)">
      <OnboardingSteps origin={appOrigin()} fallbackHandle={suggestion} />
    </main>
  );
}

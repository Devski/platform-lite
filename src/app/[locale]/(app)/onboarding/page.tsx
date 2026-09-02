import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDb } from "@/db/client";
import { getAuth } from "@/lib/auth";
import { appOrigin } from "@/lib/env";
import { getHandleState, suggestHandle } from "@/lib/profile-handle";
import { HandleForm } from "../handle-form";

// #15: the one step between login and the app. Login and the 2FA challenge
// land here; a user who already has a handle is forwarded to /, everyone
// else picks one (a proposal is prefilled). Deliberately its own page, not a
// settings section: the address is the point of the product (§1), so it
// comes before the name and the photo.

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
    redirect({ href: "/", locale });
    return null;
  }
  const t = await getTranslations("Onboarding");
  const suggestion = await suggestHandle(db, session.user.id);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {t("heading")}
        </h1>
        <p className="mt-2 text-sm text-gray-600">{t("intro")}</p>
        <HandleForm
          mode="onboarding"
          origin={appOrigin()}
          initialValue={suggestion}
          currentHandle={null}
          nextChangeAt={null}
        />
      </div>
    </main>
  );
}

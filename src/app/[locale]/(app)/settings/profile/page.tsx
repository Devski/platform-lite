import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getDb } from "@/db/client";
import { getAuth } from "@/lib/auth";
import { appOrigin } from "@/lib/env";
import { getProfile } from "@/lib/profile";
import { getHandleState, suggestHandle } from "@/lib/profile-handle";
import { getStorage, keyPrefix } from "@/lib/storage";
import { HandleForm } from "../../handle-form";
import { AvatarSection } from "./avatar-section";
import { DisplayNameForm } from "./display-name-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings.profile" });
  return { title: t("title") };
}

export default async function ProfileSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    // redirect() throws; the return only narrows the type below.
    redirect({ href: "/login", locale });
    return null;
  }
  const t = await getTranslations("Settings.profile");
  const db = getDb();
  const profile = await getProfile({
    db,
    // Resolved on first use: the bucket is needed only to address an
    // existing avatar, so the page renders without S3_* (the local runner).
    storage: { publicUrl: (key) => getStorage().publicUrl(key) },
    prefix: keyPrefix(),
    userId: session.user.id,
  });
  const handleState = await getHandleState(db, session.user.id);
  // No handle yet (an account from before #15, or onboarding left early):
  // the form opens on the same proposal the onboarding step would make.
  const handleValue =
    handleState.handle ?? (await suggestHandle(db, session.user.id));
  const origin = appOrigin();

  return (
    <main className="flex min-h-screen justify-center bg-gray-50 px-4 py-12">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {t("heading")}
          </h1>
          <p className="mt-2 text-sm">
            <Link
              href="/settings/account"
              className="font-semibold text-blue-700 hover:underline"
            >
              {t("accountLink")}
            </Link>
          </p>
        </div>

        <section className="rounded-lg border border-gray-200 bg-white p-8">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("name.heading")}
          </h2>
          <DisplayNameForm initialName={profile.displayName ?? ""} />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-8">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("avatar.heading")}
          </h2>
          <AvatarSection currentUrl={profile.avatar?.url512 ?? null} />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-8">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("handle.heading")}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {handleState.handle
              ? t("handle.current", {
                  address: `${origin}/${handleState.handle}`,
                })
              : t("handle.empty")}
          </p>
          <HandleForm
            mode="settings"
            origin={origin}
            currentHandle={handleState.handle}
            initialValue={handleValue}
            nextChangeAt={handleState.nextChangeAt?.toISOString() ?? null}
          />
        </section>
      </div>
    </main>
  );
}

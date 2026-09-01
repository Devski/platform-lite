import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getDb } from "@/db/client";
import { getAuth } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { getStorage, keyPrefix } from "@/lib/storage";
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
  const profile = await getProfile({
    db: getDb(),
    storage: getStorage(),
    prefix: keyPrefix(),
    userId: session.user.id,
  });

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
      </div>
    </main>
  );
}

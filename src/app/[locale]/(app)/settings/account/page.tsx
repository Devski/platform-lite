import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getAuth } from "@/lib/auth";
import { ChangeEmailForm } from "./change-email-form";
import { ChangePasswordForm } from "./change-password-form";
import { TwoFactorSettings } from "./two-factor-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings.account" });
  return { title: t("title") };
}

export default async function AccountSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The (app) layout already gated the render; this re-fetch supplies the
  // page's own data (the account address) and covers the layout-less edge in
  // tests of this file, so the guard repeats.
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    // redirect() throws; the return only narrows the type below.
    redirect({ href: "/login", locale });
    return null;
  }
  const t = await getTranslations("Settings.account");

  return (
    <main className="flex min-h-screen justify-center bg-gray-50 px-4 py-12">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {t("heading")}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {t("currentEmail", { email: session.user.email })}
          </p>
        </div>

        <section className="rounded-lg border border-gray-200 bg-white p-8">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("password.heading")}
          </h2>
          <ChangePasswordForm />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-8">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("email.heading")}
          </h2>
          <ChangeEmailForm currentEmail={session.user.email} />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-8">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("twoFactor.heading")}
          </h2>
          <TwoFactorSettings enabled={session.user.twoFactorEnabled === true} />
        </section>
      </div>
    </main>
  );
}

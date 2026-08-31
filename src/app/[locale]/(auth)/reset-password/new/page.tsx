import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { NewPasswordForm } from "./new-password-form";

// Landing page for the password-reset link (A3). Better Auth redirects here:
// with ?token= when the link is good, with ?error=INVALID_TOKEN when it is
// invalid, expired or already used.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ResetPassword" });
  return { title: t("title") };
}

export default async function NewPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("ResetPassword.new");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8">
        {token ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {t("heading")}
            </h1>
            <NewPasswordForm token={token} />
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {t("invalid.heading")}
            </h1>
            <p className="text-sm text-gray-600">{t("invalid.body")}</p>
            <Link
              href="/reset-password"
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              {t("invalid.requestLink")}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

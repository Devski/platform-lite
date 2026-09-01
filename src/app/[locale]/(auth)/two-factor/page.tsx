import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveModes } from "./modes";
import { TwoFactorChallenge } from "./two-factor-challenge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "TwoFactor" });
  return { title: t("title") };
}

// Post-password login challenge (#29). Reached after sign-in reports
// twoFactorRedirect; the account has no session until a second factor passes.
export default async function TwoFactorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ methods?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { methods } = await searchParams;
  const t = await getTranslations("TwoFactor");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {t("heading")}
        </h1>
        <TwoFactorChallenge modes={resolveModes(methods)} />
        <p className="mt-6 text-sm text-gray-600">
          <Link
            href="/login"
            className="font-semibold text-blue-700 hover:underline"
          >
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </main>
  );
}

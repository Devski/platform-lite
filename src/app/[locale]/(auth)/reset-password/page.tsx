import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RequestForm } from "./request-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ResetPassword" });
  return { title: t("title") };
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ResetPassword.request");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {t("heading")}
        </h1>
        <RequestForm />
        <p className="mt-6 text-sm text-gray-600">
          {t("loginPrompt")}{" "}
          <Link
            href="/login"
            className="font-semibold text-blue-700 hover:underline"
          >
            {t("loginLink")}
          </Link>
        </p>
      </div>
    </main>
  );
}

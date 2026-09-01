import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Landing page for the e-mail-change confirmation link (A10). Better Auth
// redirects here: plain on success, with ?error=TOKEN_EXPIRED when the JWT
// aged out, and with other error codes (INVALID_TOKEN from the pending-change
// gate, USER_NOT_FOUND after a completed change, ...) that all mean the link
// no longer works.
function changeState(
  error: string | undefined,
): "success" | "expired" | "invalid" {
  if (!error) return "success";
  if (error === "TOKEN_EXPIRED") return "expired";
  return "invalid";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "EmailChanged" });
  return { title: t("title") };
}

export default async function EmailChangedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error } = await searchParams;
  const t = await getTranslations("EmailChanged");
  const state = changeState(error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {t(`${state}Heading`)}
          </h1>
          <p className="text-sm text-gray-600">{t(`${state}Body`)}</p>
          <Link
            href="/settings/account"
            className="text-sm font-semibold text-blue-700 hover:underline"
          >
            {t("settingsLink")}
          </Link>
        </div>
      </div>
    </main>
  );
}

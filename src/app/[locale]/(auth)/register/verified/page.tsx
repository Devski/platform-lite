import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ResendForm } from "./resend-form";

// Landing page for the e-mail verification link (A1). Better Auth redirects
// here: plain on success, with ?error=TOKEN_EXPIRED / INVALID_TOKEN / ... when
// the token was rejected.
export default async function VerifiedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error } = await searchParams;
  const t = await getTranslations("Register.verified");

  const state = !error
    ? ("success" as const)
    : error === "TOKEN_EXPIRED"
      ? ("expired" as const)
      : ("invalid" as const);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8">
        {state === "success" ? (
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {t("successHeading")}
            </h1>
            <p className="text-sm text-gray-600">{t("successBody")}</p>
            <Link
              href="/"
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              {t("homeLink")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {t(state === "expired" ? "expiredHeading" : "invalidHeading")}
            </h1>
            <p className="text-sm text-gray-600">
              {t(state === "expired" ? "expiredBody" : "invalidBody")}
            </p>
            <ResendForm />
          </div>
        )}
      </div>
    </main>
  );
}

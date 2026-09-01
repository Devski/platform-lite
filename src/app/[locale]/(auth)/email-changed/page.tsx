import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Landing page for the two-step e-mail-change links (A10). Better Auth
// redirects here after each click: the old-address approval lands plain
// ("approved"), the new-address verification lands with ?status=done
// ("changed"), and a rejected link arrives with ?error=TOKEN_EXPIRED (aged
// out) or another code (INVALID_TOKEN from the pending-change gate, ...).
function changeState(
  error: string | undefined,
  status: string | undefined,
): "changed" | "approved" | "expired" | "invalid" {
  if (error === "TOKEN_EXPIRED") return "expired";
  if (error) return "invalid";
  return status === "done" ? "changed" : "approved";
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
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error, status } = await searchParams;
  const t = await getTranslations("EmailChanged");
  const state = changeState(error, status);

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

import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("HomePage");
  const tSwitcher = await getTranslations("LanguageSwitcher");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white">
      <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
        {t("brand")}
      </h1>
      <p className="text-gray-600">{t("tagline")}</p>
      <nav aria-label={tSwitcher("label")} className="flex gap-3 text-sm">
        {routing.locales.map((l) => (
          <Link
            key={l}
            href="/"
            locale={l}
            className={
              l === locale
                ? "font-semibold text-blue-700 underline"
                : "text-gray-600 hover:underline"
            }
          >
            {tSwitcher(l)}
          </Link>
        ))}
      </nav>
    </main>
  );
}

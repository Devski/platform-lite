import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// The 404 body for everything under [locale]: an address that belongs to no
// profile (#18) and any other notFound() a page throws. It renders inside the
// locale layout, so getTranslations() reads the request's locale exactly as
// the pages do (A8) — no params reach a not-found boundary.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  return { title: t("title") };
}

export default async function NotFoundPage() {
  const t = await getTranslations("NotFound");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
        {t("heading")}
      </h1>
      <p className="max-w-md text-gray-600">{t("body")}</p>
      <Link href="/" className="font-semibold text-blue-700 hover:underline">
        {t("homeLink")}
      </Link>
    </main>
  );
}

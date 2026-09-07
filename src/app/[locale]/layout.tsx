import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: t("title"),
    description: t("description"),
    // What the share picture's address is resolved against. og:image must be
    // absolute, and Next's own default is http://localhost:<port> — it does
    // NOT read the request's Host — so without this a shared link advertises
    // a picture on the reader's own machine.
    //
    // Read leniently, not through appOrigin(): this runs during `next build`
    // too, where the container has no APP_URL and requireEnv would fail the
    // build. A page rendered per request (the landing page, which is what
    // gets shared) picks up the deployment's real value; a prerendered one
    // keeps Next's default, which is why this cannot simply be baked in at
    // build time — one image serves dev, the previews and production.
    metadataBase: metadataBase(),
  };
}

function metadataBase(): URL | undefined {
  const origin = process.env.APP_URL?.trim();
  if (!origin) return undefined;
  try {
    return new URL(origin);
  } catch {
    // An unparsable APP_URL is a deployment fault, but metadata is the wrong
    // place to take the site down over it: the pages still render, the share
    // picture just falls back to Next's default.
    return undefined;
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { TextLink } from "@/components/ui/text-link";
import { AUTH_COLUMN, AUTH_HEADING, AUTH_MAIN } from "../shell";
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
    <main className={AUTH_MAIN}>
      <div className={AUTH_COLUMN}>
        <Logo size="compact" />
        <Card padding="lg" className="w-full">
          <h1 className={AUTH_HEADING}>{t("heading")}</h1>
          <TwoFactorChallenge modes={resolveModes(methods)} />
        </Card>
        <p className="type-sm text-center text-(--text-muted)">
          <TextLink href="/login" tone="muted">
            {t("backToLogin")}
          </TextLink>
        </p>
      </div>
    </main>
  );
}

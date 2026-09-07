import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { TextLink } from "@/components/ui/text-link";
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
    <main className="flex min-h-screen items-center justify-center bg-(--surface-page) p-(--sp-7)">
      <div className="flex w-full max-w-(--measure-form) flex-col items-center gap-(--sp-6)">
        <Logo href="/" size="compact" />
        <Card padding="lg" className="w-full">
          <h1 className="type-h1 text-(--text-strong)">{t("heading")}</h1>
          <RequestForm />
        </Card>
        <p className="type-sm text-center text-(--text-muted)">
          {t("loginPrompt")}{" "}
          <TextLink href="/login">{t("loginLink")}</TextLink>
        </p>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { TextLink } from "@/components/ui/text-link";
import { LoginForm } from "./login-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Login" });
  return { title: t("title") };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-(--surface-page) p-(--sp-7)">
      <div className="flex w-full max-w-(--measure-form) flex-col items-center gap-(--sp-6)">
        <Logo href="/" size="compact" />
        <Card padding="lg" className="w-full">
          <h1 className="type-h1 text-(--text-strong)">{t("heading")}</h1>
          <LoginForm />
        </Card>
        <p className="type-sm text-center text-(--text-muted)">
          {t("registerPrompt")}{" "}
          <TextLink href="/register">{t("registerLink")}</TextLink>
        </p>
      </div>
    </main>
  );
}

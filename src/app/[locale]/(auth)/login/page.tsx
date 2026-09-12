import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { TextLink } from "@/components/ui/text-link";
import { AUTH_COLUMN, AUTH_HEADING, AUTH_MAIN } from "../shell";
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
    <main className={AUTH_MAIN}>
      <div className={AUTH_COLUMN}>
        <Logo size="compact" />
        <Card padding="lg" className="w-full">
          <h1 className={AUTH_HEADING}>{t("heading")}</h1>
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

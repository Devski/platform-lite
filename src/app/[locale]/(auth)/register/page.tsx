import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { TextLink } from "@/components/ui/text-link";
import { AUTH_COLUMN, AUTH_HEADING, AUTH_MAIN } from "../shell";
import { RegisterForm } from "./register-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Register" });
  return { title: t("title") };
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Register");

  return (
    <main className={AUTH_MAIN}>
      <div className={AUTH_COLUMN}>
        <Logo href="/" size="compact" />
        <Card padding="lg" className="w-full">
          <h1 className={AUTH_HEADING}>{t("heading")}</h1>
          <RegisterForm />
        </Card>
        <p className="type-sm text-center text-(--text-muted)">
          {t("loginPrompt")}{" "}
          <TextLink href="/login">{t("loginLink")}</TextLink>
        </p>
      </div>
    </main>
  );
}

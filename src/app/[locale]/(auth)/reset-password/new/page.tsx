import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { TextLink } from "@/components/ui/text-link";
import { NewPasswordForm } from "./new-password-form";

// Landing page for the password-reset link (A3). Better Auth redirects here:
// with ?token= when the link is good, with ?error=INVALID_TOKEN when it is
// invalid, expired or already used.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ResetPassword" });
  return { title: t("title") };
}

export default async function NewPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("ResetPassword.new");

  return (
    <main className="flex min-h-screen items-center justify-center bg-(--surface-page) p-(--sp-7)">
      <div className="flex w-full max-w-(--measure-form) flex-col items-center gap-(--sp-6)">
        <Logo href="/" size="compact" />
        <Card padding="lg" className="w-full">
          {token ? (
            <>
              <h1 className="type-h1 text-(--text-strong)">{t("heading")}</h1>
              <NewPasswordForm token={token} />
            </>
          ) : (
            <>
              <h1 className="type-h1 text-(--text-strong)">
                {t("invalid.heading")}
              </h1>
              <p className="mt-(--sp-3) type-sm text-(--text-muted)">
                {t("invalid.body")}
              </p>
              <p className="mt-(--sp-7)">
                <TextLink href="/reset-password">
                  {t("invalid.requestLink")}
                </TextLink>
              </p>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}

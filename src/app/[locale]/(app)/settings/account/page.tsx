import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getAuth } from "@/lib/auth";
import { AccountMenu } from "@/components/ui/account-menu";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { Logo } from "@/components/ui/logo";
import { TopBar } from "@/components/ui/top-bar";
import { getDb } from "@/db/client";
import { getHandleState } from "@/lib/profile-handle";
import { ChangeEmailForm } from "./change-email-form";
import { ChangePasswordForm } from "./change-password-form";
import { TwoFactorSettings } from "./two-factor-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings.account" });
  return { title: t("title") };
}

export default async function AccountSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The (app) layout already gated the render; this re-fetch supplies the
  // page's own data (the account address) and covers the layout-less edge in
  // tests of this file, so the guard repeats.
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    // redirect() throws; the return only narrows the type below.
    redirect({ href: "/login", locale });
    return null;
  }
  const t = await getTranslations("Settings.account");
  // The top bar's account menu needs somewhere for "Profil" to point at —
  // the same handle lookup the (app) pages already do.
  const { handle } = await getHandleState(getDb(), session.user.id);

  return (
    <>
      <TopBar
        maxWidth="measure-page"
        left={<Logo href={handle ? `/${handle}` : "/"} />}
        right={
          <AccountMenu
            handle={handle ?? ""}
            avatarUrl={null}
            displayName={session.user.email}
          />
        }
      />
      <main className="mx-auto max-w-(--measure-form) px-(--sp-7) pt-(--sp-10) pb-(--sp-14)">
        <Card padding="default" className="flex flex-col gap-(--sp-6)">
          <h1 className="type-h1 text-(--text-strong)">{t("heading")}</h1>
          <Divider />
          <h2 className="type-h3 text-(--text-strong)">
            {t("password.heading")}
          </h2>
          <ChangePasswordForm />
          <Divider />
          <h2 className="type-h3 text-(--text-strong)">
            {t("email.heading")}
          </h2>
          <ChangeEmailForm currentEmail={session.user.email} />
          <Divider />
          <TwoFactorSettings enabled={session.user.twoFactorEnabled === true} />
        </Card>
      </main>
    </>
  );
}

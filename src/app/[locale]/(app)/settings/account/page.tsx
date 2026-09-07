import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getAuth } from "@/lib/auth";
import { AccountMenu } from "@/components/ui/account-menu";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { Logo } from "@/components/ui/logo";
import { TextLink } from "@/components/ui/text-link";
import { TopBar } from "@/components/ui/top-bar";
import { getDb } from "@/db/client";
import { appOrigin } from "@/lib/env";
import { getHandleState, suggestHandle } from "@/lib/profile-handle";
import { HandleForm } from "../../handle-form";
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
  // The address section moved here when #58 folded the profile-settings
  // screen away; it kept its own message keys.
  const tProfile = await getTranslations("Settings.profile");
  const db = getDb();
  // Also what the top bar's account menu needs, for "Profil" to point at.
  const handleState = await getHandleState(db, session.user.id);
  const handle = handleState.handle;
  // No handle yet (an account from before #15, or onboarding left early):
  // the form opens on the same proposal the onboarding step would make.
  const handleValue = handle ?? (await suggestHandle(db, session.user.id));
  const origin = appOrigin();

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
          {/* First of the sections: the address is the point of the product
              (§1), and the rest of this page is what protects it.

              The heading and the current-address line are one group, so they
              sit closer to each other than to the form. Every other section
              here is heading-then-form with the card's own gap between them,
              and this keeps that same rhythm rather than adding margins that
              would compound with it. */}
          <div className="flex flex-col gap-(--sp-3)">
            <h2 className="type-h3 text-(--text-strong)">
              {tProfile("handle.heading")}
            </h2>
            <p className="type-sm text-(--text-muted)">
              {handle
                ? // The address is a live page since #18, so the line is the
                  // way to it: the owner sees exactly what a visitor sees.
                  tProfile.rich("handle.current", {
                    address: `${origin}/${handle}`,
                    link: (chunks) => (
                      <TextLink href={`/${handle}`}>{chunks}</TextLink>
                    ),
                  })
                : tProfile("handle.empty")}
            </p>
          </div>
          <HandleForm
            mode="settings"
            origin={origin}
            currentHandle={handle}
            initialValue={handleValue}
            nextChangeAt={handleState.nextChangeAt?.toISOString() ?? null}
          />
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

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
import { getProfile } from "@/lib/profile";
import { getHandleState, suggestHandle } from "@/lib/profile-handle";
import { getStorage, keyPrefix } from "@/lib/storage";
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
  // The account menu draws the same avatar and monogram here as it does on
  // the profile page, so it reads the same profile row. Passing null for the
  // photo (and the e-mail for the name) left this one screen showing a
  // monogram of the address while every other screen showed the face.
  const profile = await getProfile({
    db,
    // Resolved on first use: the bucket is only needed to address an existing
    // avatar, so the page still renders without S3_* configured.
    storage: { publicUrl: (key) => getStorage().publicUrl(key) },
    prefix: keyPrefix(),
    userId: session.user.id,
  });
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
            avatarUrl={profile.avatar?.url128 ?? null}
            // The e-mail is the last resort, not the source: since #36 a
            // profile always has a name by the time it has a handle, and a
            // monogram cut from an address reads as a different account.
            displayName={profile.displayName ?? session.user.email}
          />
        }
      />
      {/* The gutter mirrors TopBar's own (16px below sm, 24px from sm up), so
          the card's edge lines up with the logo above it on a phone. The
          vertical padding is the handoff's desktop rhythm and only that: 40
          above and 80 below is a seventh of a 390px screen spent on nothing,
          so both step down one stop below sm. */}
      <main className="mx-auto max-w-(--measure-form) px-(--sp-5) pt-(--sp-7) pb-(--sp-10) sm:px-(--sp-7) sm:pt-(--sp-10) sm:pb-(--sp-14)">
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
            {/* wrap-break-word is inherited, so it covers the address inside
                the link too: an address is one unbreakable token, and a
                handle with no hyphen in it has no break opportunity at all —
                without a rule it runs straight out of the card on a phone. */}
            <p className="type-sm wrap-break-word text-(--text-muted)">
              {handle
                ? // The address is a live page since #18, so the line is the
                  // way to it: the owner sees exactly what a visitor sees.
                  tProfile.rich("handle.current", {
                    address: `${origin}/${handle}`,
                    // Renders the same address the placeholder carries, split
                    // at the slash — the one break a reader expects in a URL,
                    // and the same treatment the preview under the field
                    // below gets. Without it the fallback break lands
                    // mid-handle, which reads as a broken address.
                    link: () => (
                      <TextLink href={`/${handle}`}>
                        {`${origin}/`}
                        <wbr />
                        {handle}
                      </TextLink>
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

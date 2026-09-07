import { getTranslations, setRequestLocale } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { TextLink } from "@/components/ui/text-link";
import { ResendForm } from "./resend-form";

// Landing page for the e-mail verification link (A1). Better Auth redirects
// here: plain on success, with ?error=TOKEN_EXPIRED / INVALID_TOKEN / ... when
// the token was rejected.
function verificationState(
  error: string | undefined,
): "success" | "expired" | "invalid" {
  if (!error) return "success";
  if (error === "TOKEN_EXPIRED") return "expired";
  return "invalid";
}

// State color is the one place this monochrome system saturates, so the
// medallion carries the outcome before the heading is read. Decorative: the
// icon is aria-hidden and the heading below says the same thing in words.
const MEDALLION =
  "flex h-(--sp-10) w-(--sp-10) items-center justify-center rounded-full";

export default async function VerifiedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error } = await searchParams;
  const t = await getTranslations("Register.verified");
  const state = verificationState(error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-(--surface-page) p-(--sp-7)">
      <div className="flex w-full max-w-(--measure-form) flex-col items-center gap-(--sp-6)">
        <Logo href="/" size="compact" />
        <Card padding="lg" className="w-full">
          {state === "success" ? (
            <>
              <span
                className={`${MEDALLION} bg-(--state-success-bg) text-(--state-success)`}
              >
                <Icon name="check" size={24} />
              </span>
              <h1 className="mt-(--sp-5) type-h1 text-(--text-strong)">
                {t("successHeading")}
              </h1>
              <p className="mt-(--sp-3) type-sm text-(--text-muted)">
                {t("successBody")}
              </p>
              <ButtonLink href="/onboarding" className="mt-(--sp-7) w-full">
                {t("onboardingLink")}
              </ButtonLink>
            </>
          ) : (
            <>
              <span
                className={`${MEDALLION} bg-(--state-danger-bg) text-(--state-danger)`}
              >
                <Icon name="mail" size={24} />
              </span>
              <h1 className="mt-(--sp-5) type-h1 text-(--text-strong)">
                {t(state === "expired" ? "expiredHeading" : "invalidHeading")}
              </h1>
              <p className="mt-(--sp-3) type-sm text-(--text-muted)">
                {t(state === "expired" ? "expiredBody" : "invalidBody")}
              </p>
              <ResendForm />
            </>
          )}
        </Card>
        {state === "success" && (
          <TextLink href="/" tone="muted">
            {t("homeLink")}
          </TextLink>
        )}
      </div>
    </main>
  );
}

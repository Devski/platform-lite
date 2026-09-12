import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { TextLink } from "@/components/ui/text-link";
import { AUTH_COLUMN, AUTH_HEADING, AUTH_MAIN } from "../shell";

// Landing page for the two-step e-mail-change links (A10). Better Auth
// redirects here after each click: the old-address approval lands plain
// ("approved"), the new-address verification lands with ?status=done
// ("changed"), and a rejected link arrives with ?error=TOKEN_EXPIRED (aged
// out) or another code (INVALID_TOKEN from the pending-change gate, ...).
function changeState(
  error: string | undefined,
  status: string | undefined,
): "changed" | "approved" | "expired" | "invalid" {
  if (error === "TOKEN_EXPIRED") return "expired";
  if (error) return "invalid";
  return status === "done" ? "changed" : "approved";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "EmailChanged" });
  return { title: t("title") };
}

export default async function EmailChangedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error, status } = await searchParams;
  const t = await getTranslations("EmailChanged");
  const state = changeState(error, status);

  return (
    <main className={AUTH_MAIN}>
      <div className={AUTH_COLUMN}>
        <Logo size="compact" />
        <Card padding="lg" className="w-full">
          <h1 className={AUTH_HEADING}>{t(`${state}Heading`)}</h1>
          <p className="mt-(--sp-3) type-sm text-(--text-muted)">
            {t(`${state}Body`)}
          </p>
          <p className="mt-(--sp-7)">
            <TextLink href="/settings/account">{t("settingsLink")}</TextLink>
          </p>
        </Card>
      </div>
    </main>
  );
}

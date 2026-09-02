import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale: requested }) => {
  // A page render takes its locale from the [locale] segment; an explicit
  // one (getTranslations({ locale }) — the root layout's generateMetadata
  // passes the raw param, "favicon.ico" for a missing icon) goes through the
  // same check, so an unsupported value never reaches the dictionary import.
  const locale = requested ?? (await rootParams.locale());
  if (!hasLocale(routing.locales, locale)) notFound();

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Dates render identically on the server and in the browser (no
    // hydration mismatch, no ENVIRONMENT_FALLBACK warning): one zone for the
    // whole app, the launch market's (§1). Per-user zones are not a need yet.
    timeZone: "Europe/Warsaw",
  };
});

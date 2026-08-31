import { hasLocale } from "next-intl";
import { routing, type Locale } from "./routing";

// Locale for requests the next-intl middleware never sees (its matcher
// excludes /api) — Better Auth callbacks pass the original Request here so
// transactional e-mail goes out in the caller's language. Precedence mirrors
// A8: NEXT_LOCALE cookie → Accept-Language → default locale.

function localeFromCookie(header: string | null): Locale | undefined {
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() !== "NEXT_LOCALE") continue;
    const value = pair.slice(eq + 1).trim();
    if (hasLocale(routing.locales, value)) return value;
  }
  return undefined;
}

function localeFromAcceptLanguage(header: string | null): Locale | undefined {
  if (!header) return undefined;
  let best: { locale: Locale; q: number } | undefined;
  for (const part of header.split(",")) {
    const [rawTag, ...params] = part.trim().split(";");
    // en-GB counts as en: only the base language can be supported (A8).
    const base = rawTag.trim().toLowerCase().split("-")[0];
    if (!hasLocale(routing.locales, base)) continue;
    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split("=");
      if (key === "q") {
        const parsed = Number(value);
        q = Number.isFinite(parsed) ? parsed : 0;
      }
    }
    if (!best || q > best.q) {
      best = { locale: base, q };
    }
  }
  return best?.locale;
}

export function localeFromRequest(request: Request | undefined): Locale {
  if (!request) return routing.defaultLocale;
  return (
    localeFromCookie(request.headers.get("cookie")) ??
    localeFromAcceptLanguage(request.headers.get("accept-language")) ??
    routing.defaultLocale
  );
}

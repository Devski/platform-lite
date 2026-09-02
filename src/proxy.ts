import createMiddleware from "next-intl/middleware";
import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { routing, type Locale } from "@/i18n/routing";
import { checkHandle } from "@/lib/handle";
import { resolveHandle } from "@/lib/profile-handle";

// Two jobs, in order:
//
// 1. A6/§9 — an old profile address answers 301 to the target's current
//    handle. The redirect is produced here, not in a page: a page can only
//    emit 308 (`permanentRedirect`), and the spec says 301. Only a path that
//    could be a handle is looked up — exactly one segment after an optional
//    locale prefix, passing the A5 rules — so `/login`, `/settings/profile`
//    and every other route never touch the database. Anything that is not a
//    live redirect falls through to the pages: a live handle renders the
//    profile (#18), an unknown one 404s, and a lookup failure (no
//    DATABASE_URL in the DB-less e2e job, a connection error) is treated the
//    same way, on purpose.
// 2. A8 — locale detection: pathname prefix, then the NEXT_LOCALE cookie,
//    then the Accept-Language header (next-intl).

const intl = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  return (await oldAddressRedirect(request)) ?? intl(request);
}

// The 301 for an old address; null for every other path, which then takes
// the ordinary way through the locale middleware.
async function oldAddressRedirect(
  request: NextRequest,
): Promise<NextResponse | null> {
  const candidate = handleCandidate(request.nextUrl.pathname);
  if (!candidate) return null;
  const target = await redirectTarget(candidate.handle);
  if (!target) return null;
  const url = new URL(localizedPath(target, candidate.locale), request.nextUrl);
  url.search = request.nextUrl.search;
  return NextResponse.redirect(url, 301);
}

// The A8 prefix rule (`localePrefix: "as-needed"`) by hand: next-intl's
// getPathname would pull the request config (next/root-params) into the
// proxy bundle, which Next refuses to build.
function localizedPath(handle: string, locale: Locale): string {
  return locale === routing.defaultLocale
    ? `/${handle}`
    : `/${locale}/${handle}`;
}

/** Exported for tests: the one path shape that can be an old address. */
export function handleCandidate(
  pathname: string,
): { locale: Locale; handle: string } | null {
  const segments = pathname.split("/").filter(Boolean);
  const prefix = segments[0];
  const prefixed = hasLocale(routing.locales, prefix);
  const rest = prefixed ? segments.slice(1) : segments;
  if (rest.length !== 1) return null;
  const handle = rest[0];
  if (checkHandle(handle) !== null) return null;
  return { locale: prefixed ? prefix : routing.defaultLocale, handle };
}

async function redirectTarget(handle: string): Promise<string | null> {
  try {
    const resolution = await resolveHandle(getDb(), handle);
    return resolution.kind === "redirect" ? resolution.handle : null;
  } catch (error) {
    // Fail open to the page, which 404s — the DB-less e2e job relies on it —
    // but say so: a silent branch would turn a wrong DATABASE_URL, a dead
    // pool or a SQL error into "old addresses 404" with nothing in the log.
    console.error("[proxy] redirect lookup failed:", error);
    return null;
  }
}

export const config = {
  // Skip Next's own paths and files. The exclusions are whole segments on
  // purpose: a handle such as `apiary` must still reach the middleware
  // (#15 review — a bare `api` prefix would swallow it). The `/api` exclusion
  // is load-bearing beyond routing: it keeps request bodies away from Next's
  // proxy buffering (`proxyClientMaxBodySize`), which lib/api-route's 64 KiB
  // body bound relies on — a matched route would be buffered before its
  // handler ran.
  matcher: "/((?!api(?:/|$)|_next(?:/|$)|_vercel(?:/|$)|.*\\..*).*)",
};

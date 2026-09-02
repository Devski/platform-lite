import createMiddleware from "next-intl/middleware";
import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { routing, type Locale } from "@/i18n/routing";
import { isMissingEnv } from "@/lib/env";
import { checkHandle } from "@/lib/handle";
import { resolveHandle } from "@/lib/profile-handle";

// Three jobs, in order:
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
// 3. A7 — the noindex mark outside production, on every answer above.

const intl = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = (await oldAddressRedirect(request)) ?? intl(request);
  // A7/§8: only production is indexed. APP_ENV is set by the deployment;
  // everything else — a local run, dev, a PR preview — carries the same
  // content on a different host and must stay out of every index. The header
  // rides here rather than on each page so no route can forget it; /api is
  // outside the matcher and needs no robots directive.
  if (process.env.APP_ENV !== "production") {
    response.headers.set("x-robots-tag", "noindex");
  }
  return response;
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
  // 301 is the permanent signal search engines want (A6), but a browser
  // caches a 301 with no freshness information indefinitely — and the old
  // address may be claimed by somebody else tomorrow (§9 release, the §10
  // risk). no-store keeps every client re-asking, so the database's answer
  // is always the one that counts.
  return NextResponse.redirect(url, {
    status: 301,
    headers: { "cache-control": "no-store" },
  });
}

// The A8 prefix rule (`localePrefix: "as-needed"`) by hand: next-intl's
// getPathname would pull the request config (next/root-params) into the
// proxy bundle, which Next refuses to build. src/proxy.test.ts pins this to
// the routing config, so a change of the prefix strategy fails a test here.
export function localizedPath(handle: string, locale: Locale): string {
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

// Fail-open must also be fail-fast: a stalled database would otherwise
// hold every handle-shaped public GET for as long as the pool waits.
const LOOKUP_TIMEOUT_MS = 1500;

async function redirectTarget(handle: string): Promise<string | null> {
  try {
    const resolution = await withTimeout(
      resolveHandle(getDb(), handle),
      LOOKUP_TIMEOUT_MS,
    );
    return resolution.kind === "redirect" ? resolution.handle : null;
  } catch (error) {
    // Fail open to the page, which 404s — but say so: a silent branch would
    // turn a wrong DATABASE_URL, a dead pool, a SQL error or the timeout
    // above into "old addresses 404" with nothing in the log. The one
    // expected case stays quiet: no DATABASE_URL at all (the DB-less e2e
    // job), which requireEnv reports by message.
    if (!isMissingEnv(error)) {
      console.error("[proxy] redirect lookup failed:", error);
    }
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`redirect lookup timed out after ${ms} ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
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

import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale detection per A8: pathname prefix, then the NEXT_LOCALE cookie,
// then the Accept-Language header.
export default createMiddleware(routing);

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

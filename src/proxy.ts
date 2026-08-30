import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale detection per A8: pathname prefix, then the NEXT_LOCALE cookie,
// then the Accept-Language header.
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};

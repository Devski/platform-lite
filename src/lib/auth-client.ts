"use client";

import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Same-origin /api/auth — the default base URL — so no base needed.
// The two-factor plugin (#29) adds authClient.twoFactor.* and surfaces the
// twoFactorRedirect signal to the sign-in caller. No twoFactorPage/
// onTwoFactorRedirect here on purpose: the login form owns the redirect so it
// routes through the locale-aware next-intl router.
export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});

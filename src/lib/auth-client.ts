"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin /api/auth — the default base URL — so no configuration here.
export const authClient = createAuthClient();

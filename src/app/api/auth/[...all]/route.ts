import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// Resolved per request, not at module scope: build-time page-data collection
// and the DB-less e2e dev server evaluate this module without DATABASE_URL.
export const { GET, POST } = toNextJsHandler((request) =>
  getAuth().handler(request),
);

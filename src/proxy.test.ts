import { describe, expect, it, vi } from "vitest";
import { HANDLE_PATTERN } from "@/lib/handle";
import { config } from "./proxy";

// Only the matcher is under test; the middleware factory needs Next's server
// runtime, which the unit environment does not provide.
vi.mock("next-intl/middleware", () => ({ default: () => () => undefined }));

// The matcher is a path-to-regexp pattern whose single custom group is a
// plain JS regex. Testing that group directly proves which paths reach the
// locale middleware (A8) and which stay with Next: its own paths, the API,
// files — and that a valid handle can never fall on the wrong side (#15).
function reachesMiddleware(pathname: string): boolean {
  const inner = config.matcher.match(/^\/\((.*)\)$/)?.[1];
  if (!inner) throw new Error("unexpected matcher shape");
  return new RegExp(`^(?:${inner})$`).test(pathname.slice(1));
}

describe("proxy matcher (A8 locale middleware)", () => {
  it("routes pages and future profile addresses through the middleware", () => {
    for (const path of ["/", "/login", "/en/login", "/studio-praga"]) {
      expect(reachesMiddleware(path)).toBe(true);
    }
  });

  it("does not swallow a handle that merely starts with an excluded word", () => {
    for (const handle of ["apiary", "api-studio", "vercelio"]) {
      expect(HANDLE_PATTERN.test(handle)).toBe(true);
      expect(reachesMiddleware(`/${handle}`)).toBe(true);
    }
  });

  it("leaves the API, Next's own paths and files alone", () => {
    for (const path of [
      "/api",
      "/api/auth/get-session",
      "/_next/static/chunk.js",
      "/_vercel/insights",
      "/favicon.ico",
      "/robots.txt",
    ]) {
      expect(reachesMiddleware(path)).toBe(false);
    }
  });
});

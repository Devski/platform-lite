import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HANDLE_PATTERN } from "@/lib/handle";
import type { HandleResolution } from "@/lib/profile-handle";
import { routing } from "@/i18n/routing";
import proxy, { config, handleCandidate, localizedPath } from "./proxy";

// The locale middleware needs Next's server runtime, which the unit
// environment does not provide, and the redirect lookup needs a database:
// both are mocked, so the tests see exactly what the proxy hands over to the
// middleware and what it answers on its own.
const mocks = vi.hoisted(() => ({
  intl: vi.fn<(request: NextRequest) => Response>(),
  getDb: vi.fn(),
  resolveHandle: vi.fn<() => Promise<HandleResolution>>(),
}));
vi.mock("next-intl/middleware", () => ({ default: () => mocks.intl }));
vi.mock("@/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/profile-handle", () => ({
  resolveHandle: mocks.resolveHandle,
}));

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

  it("keeps /api off the proxy — lib/api-route's body bound relies on seeing the raw stream — and skips Next's own paths and files", () => {
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

describe("handleCandidate (the one path shape that can be an old address)", () => {
  it("accepts a single handle-shaped segment, with or without a locale prefix", () => {
    expect(handleCandidate("/old-studio")).toEqual({
      locale: "pl",
      handle: "old-studio",
    });
    expect(handleCandidate("/en/old-studio")).toEqual({
      locale: "en",
      handle: "old-studio",
    });
    expect(handleCandidate("/old-studio/")).toEqual({
      locale: "pl",
      handle: "old-studio",
    });
  });

  it("refuses the root, a bare locale, nested paths and non-handles", () => {
    expect(handleCandidate("/")).toBeNull();
    expect(handleCandidate("/en")).toBeNull();
    expect(handleCandidate("/a/b")).toBeNull();
    expect(handleCandidate("/en/a/b")).toBeNull();
    // The pattern is lowercase; a case-variant address is #18's concern.
    expect(handleCandidate("/Old-Studio")).toBeNull();
    // Reserved words are route segments or system names, never addresses.
    expect(handleCandidate("/admin")).toBeNull();
    expect(handleCandidate("/login")).toBeNull();
    expect(handleCandidate("/en/settings")).toBeNull();
  });
});

describe("proxy: old address → 301", () => {
  // Rebuilt per test: the proxy sets headers on whatever it returns, and one
  // shared response would carry them into the next test.
  let intlResponse: NextResponse;

  beforeEach(() => {
    intlResponse = NextResponse.next();
    mocks.intl.mockReturnValue(intlResponse);
    mocks.getDb.mockReturnValue({});
    mocks.resolveHandle.mockResolvedValue({ kind: "notFound" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  function request(path: string): NextRequest {
    return new NextRequest(`http://localhost:3000${path}`);
  }

  function redirectsTo(handle: string): void {
    mocks.resolveHandle.mockResolvedValue({ kind: "redirect", handle });
  }

  async function expectFallThrough(path: string): Promise<void> {
    const req = request(path);
    const response = await proxy(req);
    expect(response).toBe(intlResponse);
    expect(mocks.intl).toHaveBeenCalledWith(req);
  }

  it("answers an uncacheable 301 to the target's current handle", async () => {
    redirectsTo("new-studio");
    const response = await proxy(request("/old-studio"));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/new-studio",
    );
    // A cached 301 would outlive the release of the old address (§9).
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.resolveHandle).toHaveBeenCalledWith({}, "old-studio");
    expect(mocks.intl).not.toHaveBeenCalled();
  });

  it("sends the default-locale prefix form to the unprefixed address", async () => {
    redirectsTo("new-studio");
    const response = await proxy(request("/pl/old-studio"));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/new-studio",
    );
  });

  it("localizedPath follows the routing config's as-needed rule for every locale", () => {
    // next-intl's own getPathname cannot run here (it needs the request
    // config), so the hand-written rule is pinned to the config it mirrors.
    expect(routing.localePrefix).toBe("as-needed");
    for (const locale of routing.locales) {
      expect(localizedPath("x", locale)).toBe(
        locale === routing.defaultLocale ? "/x" : `/${locale}/x`,
      );
    }
  });

  it("keeps the locale prefix on the new address", async () => {
    redirectsTo("new-studio");
    const response = await proxy(request("/en/old-studio"));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/en/new-studio",
    );
  });

  it("carries the query string over", async () => {
    redirectsTo("new-studio");
    const response = await proxy(request("/old-studio?ref=x&utm=y"));
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/new-studio?ref=x&utm=y",
    );
  });

  it("never looks up a route segment or a nested path", async () => {
    for (const path of ["/", "/login", "/en/login", "/settings/account"]) {
      await expectFallThrough(path);
    }
    expect(mocks.resolveHandle).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("hands a live profile and an unknown address to the middleware", async () => {
    mocks.resolveHandle.mockResolvedValue({ kind: "profile", userId: "u1" });
    await expectFallThrough("/live-studio");
    mocks.resolveHandle.mockResolvedValue({ kind: "notFound" });
    await expectFallThrough("/nobody-here");
    expect(mocks.resolveHandle).toHaveBeenCalledTimes(2);
  });

  // Fail-open is deliberate, silence is not: a failed lookup leaves a trace
  // in the server log (a wrong DATABASE_URL in the proxy's environment would
  // otherwise show up only as old addresses 404ing). The one quiet branch is
  // the expected no-database case of the DB-less e2e job.
  describe("fails open to the middleware, logging the cause", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it("without a database (the DB-less e2e job) — quietly", async () => {
      mocks.getDb.mockImplementation(() => {
        throw new Error("Missing required environment variable DATABASE_URL");
      });
      await expectFallThrough("/old-studio");
      expect(mocks.resolveHandle).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("when the lookup stalls, after the timeout", async () => {
      vi.useFakeTimers();
      try {
        mocks.resolveHandle.mockReturnValue(new Promise(() => {}));
        const pending = proxy(request("/old-studio"));
        await vi.advanceTimersByTimeAsync(1500);
        expect(await pending).toBe(intlResponse);
        expect(errorSpy).toHaveBeenCalledWith(
          "[proxy] redirect lookup failed:",
          expect.objectContaining({
            message: expect.stringContaining("timed out"),
          }),
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("when the lookup itself fails", async () => {
      const refused = new Error("connection refused");
      mocks.resolveHandle.mockRejectedValue(refused);
      await expectFallThrough("/old-studio");
      expect(errorSpy).toHaveBeenCalledWith(
        "[proxy] redirect lookup failed:",
        refused,
      );
    });
  });

  // A7/§8: dev, PR previews and local runs serve the same content on another
  // host — only the production deployment (APP_ENV=production) is indexable.
  describe("X-Robots-Tag outside production", () => {
    it("marks the middleware's response when APP_ENV is unset (a local run)", async () => {
      vi.stubEnv("APP_ENV", undefined);
      const response = await proxy(request("/"));
      expect(response).toBe(intlResponse);
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
    });

    it("marks the 301 too, so an old address cannot be indexed either", async () => {
      vi.stubEnv("APP_ENV", "development");
      redirectsTo("new-studio");
      const response = await proxy(request("/old-studio"));
      expect(response.status).toBe(301);
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
    });

    it("leaves production untouched — that is the one indexed environment", async () => {
      vi.stubEnv("APP_ENV", "production");
      const page = await proxy(request("/live-studio"));
      expect(page.headers.get("x-robots-tag")).toBeNull();
      redirectsTo("new-studio");
      const redirected = await proxy(request("/old-studio"));
      expect(redirected.status).toBe(301);
      expect(redirected.headers.get("x-robots-tag")).toBeNull();
    });
  });
});

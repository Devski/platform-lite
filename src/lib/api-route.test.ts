import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  checkRateLimit,
  JSON_BODY_MAX_BYTES,
  parseJsonBody,
  rejectCrossSite,
  sessionUserId,
} from "./api-route";

// Unit suite for the shared route plumbing. getAuth is mocked per branch —
// the real session machinery has its own integration suites.

vi.mock("@/lib/auth", () => ({ getAuth: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { getAuth } = vi.mocked(await import("@/lib/auth"));

function authReturning(session: unknown) {
  getAuth.mockReturnValue({
    api: { getSession: async () => session },
  } as unknown as ReturnType<typeof getAuth>);
}

describe("sessionUserId (fail-closed)", () => {
  it("returns the id for a live session", async () => {
    authReturning({ user: { id: "user-1" } });
    expect(await sessionUserId()).toBe("user-1");
  });

  it("returns null for no session", async () => {
    authReturning(null);
    expect(await sessionUserId()).toBeNull();
  });

  it("reads an unverifiable session as signed out, never an error", async () => {
    getAuth.mockImplementation(() => {
      throw new Error("Missing required environment variable DATABASE_URL");
    });
    expect(await sessionUserId()).toBeNull();
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ value: z.number().int().min(1) });

  function request(
    body?: string,
    headers: Record<string, string> = {},
  ): Request {
    return new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    });
  }

  // A body the schema accepts, padded to exactly `bytes` (ASCII, so length is
  // byte length). Zod strips the unknown "pad" key, so only the bound can
  // refuse it — and a string body carries no Content-Length here, so it is
  // the stream bound that does.
  function paddedBody(bytes: number): string {
    const head = '{"value": 7, "pad": "';
    const tail = '"}';
    return head + "x".repeat(bytes - head.length - tail.length) + tail;
  }

  it("returns the parsed data for a valid body", async () => {
    expect(await parseJsonBody(request('{"value": 7}'), schema)).toEqual({
      value: 7,
    });
  });

  it("returns null for malformed JSON", async () => {
    expect(await parseJsonBody(request("{nope"), schema)).toBeNull();
  });

  it("returns null for a schema-invalid body", async () => {
    expect(await parseJsonBody(request('{"value": -3}'), schema)).toBeNull();
  });

  it("returns null for an empty body", async () => {
    expect(await parseJsonBody(request(), schema)).toBeNull();
  });

  it("parses a body exactly at the bound", async () => {
    const body = paddedBody(JSON_BODY_MAX_BYTES);
    expect(Buffer.byteLength(body)).toBe(JSON_BODY_MAX_BYTES);
    expect(await parseJsonBody(request(body), schema)).toEqual({ value: 7 });
  });

  it("refuses a body one byte over the bound although the schema would accept its shape", async () => {
    const body = paddedBody(JSON_BODY_MAX_BYTES + 1);
    expect(await parseJsonBody(request(body), schema)).toBeNull();
  });

  it("refuses a declared Content-Length above the bound before reading the body", async () => {
    const oversized = request('{"value": 7}', {
      "content-length": String(JSON_BODY_MAX_BYTES + 1),
    });
    expect(await parseJsonBody(oversized, schema)).toBeNull();
    expect(oversized.bodyUsed).toBe(false);
  });

  it("strips a UTF-8 BOM the way request.json() did", async () => {
    const body = "\uFEFF" + '{"value": 7}';
    expect(await parseJsonBody(request(body), schema)).toEqual({ value: 7 });
  });

  it("returns null, not an error, for a body whose stream is already locked", async () => {
    const locked = request('{"value": 7}');
    locked.body!.getReader();
    expect(await parseJsonBody(locked, schema)).toBeNull();
  });

  it("returns null, not an error, for a transport failure mid-body", async () => {
    // The first chunk arrives, then the connection drops before the rest.
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"value"'));
      },
      pull(controller) {
        controller.error(new Error("connection reset"));
      },
    });
    // Node needs `duplex: "half"` for a stream body; the cast covers a
    // lib.dom RequestInit that does not declare it.
    const failing = new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit);
    expect(await parseJsonBody(failing, schema)).toBeNull();
  });
});

describe("rejectCrossSite", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://app.example/");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function post(headers: Record<string, string>): Request {
    return new Request("https://app.example/api/x", {
      method: "POST",
      headers,
    });
  }

  it("passes a same-origin browser request", () => {
    expect(
      rejectCrossSite(
        post({
          "sec-fetch-site": "same-origin",
          origin: "https://app.example",
        }),
      ),
    ).toBeNull();
  });

  it("refuses a request the browser labels cross-site", async () => {
    const response = rejectCrossSite(
      post({ "sec-fetch-site": "cross-site", origin: "https://app.example" }),
    );
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: "forbidden" });
  });

  it("refuses a foreign Origin even without the fetch metadata", () => {
    expect(
      rejectCrossSite(post({ origin: "https://evil.example" }))?.status,
    ).toBe(403);
    // A sibling site is not us either.
    expect(
      rejectCrossSite(
        post({
          "sec-fetch-site": "same-site",
          origin: "https://sub.app.example",
        }),
      )?.status,
    ).toBe(403);
  });

  it('refuses an opaque Origin ("null" is never ours)', () => {
    expect(rejectCrossSite(post({ origin: "null" }))?.status).toBe(403);
  });

  it("passes a request carrying neither header (a tool, an old client)", () => {
    expect(rejectCrossSite(post({}))).toBeNull();
  });
});

describe("checkRateLimit", () => {
  it("allows up to max within the window, then refuses", () => {
    const key = `test:${Math.random()}`;
    for (let call = 0; call < 3; call++) {
      expect(checkRateLimit(key, { windowSeconds: 60, max: 3 })).toBe(true);
    }
    expect(checkRateLimit(key, { windowSeconds: 60, max: 3 })).toBe(false);
  });

  it("opens a fresh window after the previous one expires", () => {
    vi.useFakeTimers();
    try {
      const key = `test:${Math.random()}`;
      expect(checkRateLimit(key, { windowSeconds: 1, max: 1 })).toBe(true);
      expect(checkRateLimit(key, { windowSeconds: 1, max: 1 })).toBe(false);
      vi.advanceTimersByTime(1100);
      expect(checkRateLimit(key, { windowSeconds: 1, max: 1 })).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keys independently", () => {
    expect(
      checkRateLimit(`a:${Math.random()}`, { windowSeconds: 60, max: 1 }),
    ).toBe(true);
    expect(
      checkRateLimit(`b:${Math.random()}`, { windowSeconds: 60, max: 1 }),
    ).toBe(true);
  });
});

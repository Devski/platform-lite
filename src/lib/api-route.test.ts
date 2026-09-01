import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseJsonBody, sessionUserId } from "./api-route";

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

  function request(body: string): Request {
    return new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
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
});

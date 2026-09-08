import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getAuth } from "@/lib/auth";
import { appOrigin } from "@/lib/env";

// Shared plumbing for the JSON API routes (#12+). Kept deliberately tiny:
// routes stay thin adapters and the logic lives in the lib modules.

// Fail closed like the (app) layout: an unverifiable session — including an
// environment with no database at all — reads as signed out, never as a 500.
export async function sessionUserId(): Promise<string | null> {
  try {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    });
    return session?.user.id ?? null;
  } catch {
    return null;
  }
}

// Every body the routes accept is a few hundred bytes (a handle, a name, a
// file id, a size), so 64 KiB leaves room and refuses the rest before it is
// buffered.
export const JSON_BODY_MAX_BYTES = 64 * 1024;

/**
 * JSON body parsed through the schema; null for malformed, oversized or
 * schema-invalid input.
 */
export async function parseJsonBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<z.output<Schema> | null> {
  const text = await readBounded(request, JSON_BODY_MAX_BYTES);
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// The whole body as text, or null once it exceeds `maxBytes`, in two stages.
// The declared Content-Length refuses an honest oversized request before any
// read. The stream bound handles a chunked body (no Content-Length at all)
// and is the defence in depth against a lying header; a missing or
// unparsable header reads as 0/NaN — no verdict — and defers to the stream
// bound. The `/api` exclusion in src/proxy.ts is load-bearing here: a route
// the proxy matched would get its body buffered by Next (up to
// `proxyClientMaxBodySize`) before the handler runs, so the bound only holds
// because `/api` never matches.
async function readBounded(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > maxBytes) return null;
  if (!request.body) return null;
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    // Inside the try: getReader() throws on a locked or otherwise unusable
    // body, and that is a bad request, not a 500.
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    // An unusable body or a transport failure mid-body (the client went
    // away) is a bad request, not a server error — the same mapping
    // request.json() gave before.
    return null;
  }
  // Decoded like fetch does: a UTF-8 BOM is stripped (as request.json() did)
  // and invalid bytes become U+FFFD.
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// Cross-site guard for the state-changing routes. The session cookie is
// sameSite=lax (A2), which already keeps a cross-site POST from carrying it
// in current browsers; this is the belt on top (#15 review). A browser labels
// every request (Sec-Fetch-Site) and sends Origin on every POST, so a request
// carrying either must name us; one carrying neither (a tool, an old client)
// passes — the cookie rules still apply to it.
export function rejectCrossSite(request: Request): NextResponse | null {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return forbidden();
  }
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== appOrigin()) return forbidden();
  return null;
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

// Fixed-window limiter for the authenticated /api routes, keyed per user —
// the Better Auth limiter guards only its own /api/auth/* handler, so routes
// like the upload routes (/api/uploads/*, once /api/avatar/*) had none at
// all (#12 review). User-keyed on purpose:
// these endpoints sit behind a session, and a user key survives NAT and IP
// rotation. In-memory like better-auth's own store — a single app instance
// is the deliberate SPEC §8/§10 deployment shape.
const windows = new Map<string, { resetAt: number; count: number }>();

export function checkRateLimit(
  key: string,
  options: { windowSeconds: number; max: number },
): boolean {
  const now = Date.now();
  const window = windows.get(key);
  if (!window || window.resetAt <= now) {
    windows.set(key, { resetAt: now + options.windowSeconds * 1000, count: 1 });
    return true;
  }
  window.count += 1;
  return window.count <= options.max;
}

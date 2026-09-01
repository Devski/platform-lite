import { headers } from "next/headers";
import type { z } from "zod";
import { getAuth } from "@/lib/auth";

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

/** JSON body parsed through the schema; null for malformed or invalid input. */
export async function parseJsonBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<z.output<Schema> | null> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// Fixed-window limiter for the authenticated /api routes, keyed per user —
// the Better Auth limiter guards only its own /api/auth/* handler, so routes
// like /api/avatar/* had none at all (#12 review). User-keyed on purpose:
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

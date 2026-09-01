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

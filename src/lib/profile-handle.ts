import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import { profiles, users } from "@/db/schema";
import {
  checkHandle,
  HANDLE_MAX,
  handleBaseFrom,
  type HandleProblem,
  nextHandleChangeAt,
  normalizeHandle,
} from "@/lib/handle";

// The #15 database side of a handle: its state, availability, the onboarding
// proposal and the claim itself. The A5/A6 rules live in handle.ts (pure,
// client-safe); this module only applies them against profiles. Redirects
// from old handles and their release are #16.

export interface HandleState {
  handle: string | null;
  changedAt: Date | null;
  /** nextHandleChangeAt(changedAt, now) — null means a change is allowed now. */
  nextChangeAt: Date | null;
}

export async function getHandleState(
  db: Database,
  userId: string,
  now: Date = new Date(),
): Promise<HandleState> {
  const [row] = await db
    .select({ handle: profiles.handle, changedAt: profiles.handleChangedAt })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  const changedAt = row?.changedAt ?? null;
  return {
    handle: row?.handle ?? null,
    changedAt,
    nextChangeAt: nextHandleChangeAt(changedAt, now),
  };
}

export type HandleAvailability =
  { available: true } | { available: false; reason: HandleProblem | "taken" };

/** Normalizes first; "taken" is a case-insensitive hit on profiles.handle. */
export async function handleAvailability(
  db: Database,
  input: string,
): Promise<HandleAvailability> {
  const handle = normalizeHandle(input);
  const problem = checkHandle(handle);
  if (problem) return { available: false, reason: problem };
  const free = await firstFree(db, [handle]);
  return free ? { available: true } : { available: false, reason: "taken" };
}

// Handles are stored pre-normalized, so equality on the unique index is the
// case-insensitive lookup (schema.ts). One query for the whole candidate
// list; a candidate the A5 rules refuse never reaches the database (drizzle
// turns an empty list into a plain `false`).
async function firstFree(
  db: Database,
  candidates: string[],
): Promise<string | null> {
  const valid = candidates.filter(
    (candidate) => checkHandle(candidate) === null,
  );
  const rows = await db
    .select({ handle: profiles.handle })
    .from(profiles)
    .where(inArray(profiles.handle, valid));
  const taken = new Set(rows.map((row) => row.handle));
  return valid.find((candidate) => !taken.has(candidate)) ?? null;
}

// The proposal's tail must fit inside the A5 length: the base gives way, and
// a hyphen the cut leaves at the seam is dropped ("abc-" + "-2" → "abc-2").
function withSuffix(base: string, suffix: string): string {
  const room = HANDLE_MAX - suffix.length - 1;
  return `${base.slice(0, room).replace(/-+$/, "")}-${suffix}`;
}

const FALLBACK_BASE = "studio";
const NUMBERED_TAILS = ["2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Proposal for the onboarding page: a slug of the display name, else of
 * users.name (the e-mail local part), else "studio"; if the base is taken,
 * try base-2 … base-9, then base-<4 random hex chars> (re-checked once).
 * Never returns a reserved/invalid value. Returns the user's current
 * handle when one is set.
 */
export async function suggestHandle(
  db: Database,
  userId: string,
): Promise<string> {
  const [row] = await db
    .select({
      handle: profiles.handle,
      displayName: profiles.displayName,
      name: users.name,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId));
  if (row.handle) return row.handle;

  // The display name first, the e-mail local part (users.name) when it
  // yields nothing usable, a generic base as the last resort.
  const base =
    handleBaseFrom(row.displayName ?? "") ??
    handleBaseFrom(row.name) ??
    FALLBACK_BASE;
  const numbered = NUMBERED_TAILS.map((tail) => withSuffix(base, tail));
  const free = await firstFree(db, [base, ...numbered]);
  if (free) return free;

  // Nine collisions mean a popular base; a 4-hex tail has 65 536 variants,
  // so one check is plenty. The proposal is only a prefill — the form's live
  // availability check and the unique index remain the real guards.
  const randomTail = () => withSuffix(base, randomBytes(2).toString("hex"));
  return (await firstFree(db, [randomTail()])) ?? randomTail();
}

export type HandleErrorCode = HandleProblem | "taken" | "cooldown";

export class HandleError extends Error {
  /** When the A6 cooldown lifts — set for "cooldown" only. */
  readonly retryAt?: Date;

  constructor(
    public readonly code: HandleErrorCode,
    retryAt?: Date,
  ) {
    super(`handle rejected: ${code}`);
    this.name = "HandleError";
    if (retryAt) this.retryAt = retryAt;
  }
}

const UNIQUE_VIOLATION = "23505";

// Drizzle wraps driver errors ("Failed query: ...") and keeps the real one in
// the cause chain; both drivers (node-postgres, PGlite) expose the Postgres
// ErrorResponse fields there — the SQLSTATE as `code`, the index as
// `constraint` — so the walk is the same on every backend.
function violatesHandleUnique(error: unknown): boolean {
  for (
    let current: unknown = error;
    current instanceof Error;
    current = current.cause
  ) {
    const { code, constraint } = current as Error & {
      code?: unknown;
      constraint?: unknown;
    };
    if (code === UNIQUE_VIOLATION && constraint === "profiles_handle_unique") {
      return true;
    }
  }
  return false;
}

/**
 * Set or change the caller's handle. Transactional, serialized per user with
 * SELECT ... FOR UPDATE on the users row (the setAvatar pattern). Rules:
 *   - the A5 rules (handle.ts) → HandleError("invalid" | "reserved");
 *   - same as the current handle → no-op;
 *   - a change inside the A6 window → HandleError("cooldown", retryAt);
 *   - upsert profiles — the initial assignment leaves handle_changed_at NULL,
 *     a change stamps it with `now`;
 *   - the unique index refuses a duplicate → HandleError("taken").
 */
export async function setHandle(
  db: Database,
  userId: string,
  input: string,
  now: Date = new Date(),
): Promise<{ handle: string }> {
  const handle = normalizeHandle(input);
  const problem = checkHandle(handle);
  if (problem) throw new HandleError(problem);

  try {
    await db.transaction(async (tx) => {
      // The read-check-upsert runs serialized per user (FOR UPDATE on the
      // users row, which always exists): two overlapping calls would both
      // pass the cooldown check against the same stale stamp. The row also
      // carries users.name, the display identity the first profile write
      // is seeded with (setAvatar does the same).
      const [user] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");

      const [profile] = await tx
        .select({
          handle: profiles.handle,
          changedAt: profiles.handleChangedAt,
        })
        .from(profiles)
        .where(eq(profiles.userId, userId));
      const current = profile?.handle ?? null;
      if (current === handle) return;

      // A6: the initial assignment is not a change — only a real change
      // consults and then restarts the cooldown.
      const changing = current !== null;
      if (changing) {
        const retryAt = nextHandleChangeAt(profile?.changedAt ?? null, now);
        if (retryAt) throw new HandleError("cooldown", retryAt);
      }

      // Upsert, not insert: the first profile write can race a concurrent
      // updateDisplayName upsert, which does not take the user lock.
      // #16 extends this transaction: on a change, insert the
      // handle_redirects row (old handle → this user) and delete the redirect
      // row of the handle being claimed (§9: registering X releases X); the
      // handleChanged e-mail goes out after the commit.
      await tx
        .insert(profiles)
        .values({ userId, displayName: user.name, handle })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: changing ? { handle, handleChangedAt: now } : { handle },
        });
    });
  } catch (error) {
    // Two users claiming one free handle both pass every check above; the
    // unique index decides, and the loser learns it here (not by a pre-check,
    // which could not close the window).
    if (violatesHandleUnique(error)) throw new HandleError("taken");
    throw error;
  }
  return { handle };
}

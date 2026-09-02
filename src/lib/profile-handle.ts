import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import { handleRedirects, profiles, users } from "@/db/schema";
import type { Locale } from "@/i18n/routing";
import { sendEmail } from "@/lib/email";
import {
  checkHandle,
  HANDLE_MAX,
  handleBaseFrom,
  type HandleProblem,
  nextHandleChangeAt,
  normalizeHandle,
} from "@/lib/handle";

// The database side of a handle: its state, availability, the onboarding
// proposal, the claim itself (#15), and what a change leaves behind (#16) —
// the redirect row the old address keeps until somebody claims it, its
// release, the §9 resolution and the A10 notice. The A5/A6 rules live in
// handle.ts (pure, client-safe); this module only applies them against
// profiles and handle_redirects.

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
 *   - same as the current handle → no-op (previousHandle null);
 *   - a change inside the A6 window → HandleError("cooldown", retryAt);
 *   - upsert profiles — the initial assignment leaves handle_changed_at NULL,
 *     a change stamps it with `now`;
 *   - the unique index refuses a duplicate → HandleError("taken");
 *   - §9: the redirect row of the handle being claimed is deleted, and a
 *     change writes the row that keeps the old address pointing here.
 * `previousHandle` is the handle a change replaced, so the caller can send
 * the A10 notice after the commit; null when nothing changed hands.
 */
export async function setHandle(
  db: Database,
  userId: string,
  input: string,
  now: Date = new Date(),
): Promise<{ handle: string; previousHandle: string | null }> {
  const handle = normalizeHandle(input);
  const problem = checkHandle(handle);
  if (problem) throw new HandleError(problem);

  try {
    const previousHandle = await db.transaction(async (tx) => {
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
      if (current === handle) return null;

      // A6: the initial assignment is not a change — only a real change
      // consults and then restarts the cooldown.
      const changing = current !== null;
      if (changing) {
        const retryAt = nextHandleChangeAt(profile?.changedAt ?? null, now);
        if (retryAt) throw new HandleError("cooldown", retryAt);
      }

      // Upsert, not insert: the first profile write can race a concurrent
      // updateDisplayName upsert, which does not take the user lock.
      await tx
        .insert(profiles)
        .values({ userId, displayName: user.name, handle })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: changing ? { handle, handleChangedAt: now } : { handle },
        });

      // §9 release: registering X deletes X's redirect row, whoever it
      // pointed at — the claimant moving back to their own old address
      // included (A6: old handles return to circulation at once). Ordered
      // AFTER the profile upsert on purpose: when X's holder is leaving it
      // in a concurrent transaction, the upsert blocks on the unique index
      // until that transaction commits, and only a DELETE issued afterwards
      // sees the redirect row it inserted (READ COMMITTED snapshots are per
      // statement). Deleting first could leave a row naming a live handle.
      await tx
        .delete(handleRedirects)
        .where(eq(handleRedirects.oldHandle, handle));

      // On a change the old address keeps pointing here — a 301 in the
      // proxy — until somebody claims it. The row stores the user, not the
      // new handle, so a chain a → b → c resolves both old addresses to c
      // without rewriting rows. Upsert: the invariant says no row for a live
      // handle exists, so a stray one self-heals instead of failing the
      // change.
      if (changing) {
        await tx
          .insert(handleRedirects)
          .values({ oldHandle: current, targetUserId: userId, createdAt: now })
          .onConflictDoUpdate({
            target: handleRedirects.oldHandle,
            set: { targetUserId: userId, createdAt: now },
          });
      }
      return current;
    });
    return { handle, previousHandle };
  } catch (error) {
    // Two users claiming one free handle both pass every check above; the
    // unique index decides, and the loser learns it here (not by a pre-check,
    // which could not close the window).
    if (violatesHandleUnique(error)) throw new HandleError("taken");
    throw error;
  }
}

export type HandleResolution =
  | { kind: "profile"; userId: string }
  /** The target's CURRENT handle — where the old address should 301 to. */
  | { kind: "redirect"; handle: string }
  | { kind: "notFound" };

/**
 * §9 order on a normalized handle: profile → redirect → notFound. Reserved
 * and invalid input is notFound without a query (such a handle can never
 * have been stored). A redirect whose target has no current handle is
 * notFound too; one whose target still holds the looked-up handle cannot
 * exist here — the profile lookup would have answered first.
 */
export async function resolveHandle(
  db: Database,
  input: string,
): Promise<HandleResolution> {
  const handle = normalizeHandle(input);
  if (checkHandle(handle) !== null) return { kind: "notFound" };

  const [profile] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.handle, handle));
  if (profile) return { kind: "profile", userId: profile.userId };

  const [redirect] = await db
    .select({ handle: profiles.handle })
    .from(handleRedirects)
    .innerJoin(profiles, eq(profiles.userId, handleRedirects.targetUserId))
    .where(eq(handleRedirects.oldHandle, handle));
  if (redirect?.handle) return { kind: "redirect", handle: redirect.handle };
  return { kind: "notFound" };
}

/**
 * The A10 handle-change notice, to the account's e-mail address in the
 * given locale. Throws on delivery failure — the caller decides whether the
 * notice is best-effort (the route logs and lets the change stand).
 */
export async function notifyHandleChanged(
  db: Database,
  options: {
    userId: string;
    oldHandle: string;
    newHandle: string;
    locale: Locale;
    profileUrl: string;
  },
): Promise<void> {
  const { userId, oldHandle, newHandle, locale, profileUrl } = options;
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new Error(`handle notice: unknown user ${userId}`);
  await sendEmail({
    to: user.email,
    locale,
    template: {
      kind: "handleChanged",
      params: { oldHandle, newHandle, profileUrl },
    },
  });
}

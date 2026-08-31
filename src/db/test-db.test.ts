import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "./schema";
import { createTestDb, type TestDb } from "./test-db";

// Exercises the harness against a real engine (PGlite locally, the CI service
// container when DATABASE_URL_TEST is set) — so the committed migration, not
// the TS schema, is what these invariants are proven on (G6).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("test database harness", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await testDb.reset();
  });

  it("applies the committed migrations and generates user ids in the database", async () => {
    const [row] = await testDb.db
      .insert(users)
      .values({ name: "Test", email: "id@example.com" })
      .returning();
    // No id was supplied — the uuid comes from the gen_random_uuid() column
    // default the migration created (SPEC.md §9).
    expect(row.id).toMatch(UUID_RE);
    expect(row.emailVerified).toBe(false);
  });

  it("rejects case-variant duplicate emails via users_email_lower_unique (A1)", async () => {
    await testDb.db
      .insert(users)
      .values({ name: "A", email: "case@example.com" });
    // Drizzle wraps driver errors ("Failed query: ...") and keeps the real
    // one in the cause chain — that's where the constraint name lives.
    const rejection = await testDb.db
      .insert(users)
      .values({ name: "B", email: "Case@Example.com" })
      .then(() => null)
      .catch((error: unknown) => error);
    expect(rejection).toBeInstanceOf(Error);
    const chain: string[] = [];
    for (
      let current: unknown = rejection;
      current instanceof Error;
      current = current.cause
    ) {
      chain.push(current.message);
    }
    expect(chain.join("\n")).toContain("users_email_lower_unique");
  });

  it("reset() leaves every table empty", async () => {
    await testDb.db
      .insert(users)
      .values({ name: "Gone", email: "gone@example.com" });
    await testDb.reset();
    const rows = await testDb.db.select().from(users);
    expect(rows).toHaveLength(0);
  });
});

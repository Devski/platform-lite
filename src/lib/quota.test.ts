import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { files, users } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-db";
import { QUOTA_BYTES, quotaAllows, quotaUsageBytes } from "./quota";

// Unit suite for the A9 quota math on the real schema (PGlite): usage is a
// database-side SUM over files.size_bytes, per user.

let testDb: TestDb;
let userId: string;
let otherUserId: string;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  const rows = await testDb.db
    .insert(users)
    .values([
      { name: "quota", email: "quota@example.com" },
      { name: "other", email: "other@example.com" },
    ])
    .returning({ id: users.id });
  [userId, otherUserId] = rows.map((row) => row.id);
});

let hashCounter = 0;
function fileRow(
  ownerId: string,
  sizeBytes: number,
  kind: "avatar-original" | "avatar-512" | "avatar-128" = "avatar-original",
) {
  return {
    userId: ownerId,
    sha256: `hash-${++hashCounter}`,
    sizeBytes,
    kind,
  };
}

describe("quotaUsageBytes (A9)", () => {
  it("is zero for a user with no files", async () => {
    expect(await quotaUsageBytes(testDb.db, userId)).toBe(0);
  });

  it("sums exactly the user's own rows", async () => {
    await testDb.db
      .insert(files)
      .values([
        fileRow(userId, 1000),
        fileRow(userId, 234, "avatar-512"),
        fileRow(otherUserId, 999_999),
      ]);
    expect(await quotaUsageBytes(testDb.db, userId)).toBe(1234);
    expect(await quotaUsageBytes(testDb.db, otherUserId)).toBe(999_999);
  });

  it("handles gigabyte-scale sums exactly", async () => {
    await testDb.db
      .insert(files)
      .values([
        fileRow(userId, QUOTA_BYTES - 1),
        fileRow(userId, 1, "avatar-512"),
      ]);
    expect(await quotaUsageBytes(testDb.db, userId)).toBe(QUOTA_BYTES);
  });
});

describe("quotaAllows (A9 boundary)", () => {
  it("allows filling the quota to exactly the limit", async () => {
    await testDb.db.insert(files).values(fileRow(userId, QUOTA_BYTES - 100));
    expect(await quotaAllows(testDb.db, userId, 100)).toBe(true);
  });

  it("rejects the first byte over the limit", async () => {
    await testDb.db.insert(files).values(fileRow(userId, QUOTA_BYTES - 100));
    expect(await quotaAllows(testDb.db, userId, 101)).toBe(false);
  });

  it("one user's usage never counts against another", async () => {
    await testDb.db.insert(files).values(fileRow(otherUserId, QUOTA_BYTES));
    expect(await quotaAllows(testDb.db, userId, QUOTA_BYTES)).toBe(true);
  });
});

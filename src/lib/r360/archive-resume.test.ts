import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { files } from "@/db/schema";
import { insertTestAccount } from "@/db/test-account";
import { createTestDb, type TestDb } from "@/db/test-db";
import { updateDisplayName } from "@/lib/profile";
import { createMemoryStorage } from "@/lib/storage";
import { uploadTestArchive, uploadTestPhoto } from "@/lib/test-uploads";
import { createWork, sweepOrphanArchives } from "@/lib/works";
import { claimArchive, listUnattachedArchives } from "./archive-resume";

// #105: an archive that reached the bucket is offered back and claimed —
// and a claimed archive survives the orphan sweep while it is being read.

const PREFIX = "devski/";
let testDb: TestDb;
let userId: string;

beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.close();
});
beforeEach(async () => {
  await testDb.reset();
  userId = await insertTestAccount(testDb.db, { email: "resume@example.com" });
  await updateDisplayName({ db: testDb.db, userId }, "Pracownia Wznowień");
});

function makeDeps() {
  const memory = createMemoryStorage();
  return {
    objects: memory.objects,
    deps: { db: testDb.db, storage: memory.storage, prefix: PREFIX, userId },
  };
}

describe("listUnattachedArchives", () => {
  it("lists this user's archives no work names, newest first, and not the old ones", async () => {
    const d = makeDeps();
    const older = await uploadTestArchive(d.deps, "older");
    const newer = await uploadTestArchive(d.deps, "newer");
    const attached = await uploadTestArchive(d.deps, "attached");
    const photo = await uploadTestPhoto(d.deps, { seed: 1 });
    await createWork(d.deps, {
      name: "Z archiwum",
      imageFileIds: [photo.original.fileId],
      r360FileId: attached.fileId,
    });
    await testDb.db
      .update(files)
      .set({ createdAt: sql`now() - interval '2 hours'` })
      .where(eq(files.id, older.fileId));
    const listed = await listUnattachedArchives(d.deps);
    expect(listed.map((a) => a.fileId)).toEqual([newer.fileId, older.fileId]);
    expect(listed[0].sizeBytes).toBe(newer.sizeBytes);
    // Past the sweep's day: not offered — it may be gone any moment.
    await testDb.db
      .update(files)
      .set({ createdAt: sql`now() - interval '25 hours'` })
      .where(eq(files.id, older.fileId));
    expect((await listUnattachedArchives(d.deps)).map((a) => a.fileId)).toEqual(
      [newer.fileId],
    );
    // Another user sees nothing of it.
    const other = await insertTestAccount(testDb.db, {
      email: "other-resume@example.com",
    });
    expect(
      await listUnattachedArchives({ db: testDb.db, userId: other }),
    ).toEqual([]);
  });
});

describe("claimArchive", () => {
  it("marks the archive claimed and hands out a signed address to read it", async () => {
    const d = makeDeps();
    const archive = await uploadTestArchive(d.deps, "one");
    const claim = await claimArchive(d.deps, { fileId: archive.fileId });
    expect(claim.downloadUrl).toBe(
      `memory://download/${archive.key}?expires=${claim.expiresInSeconds}`,
    );
    expect(claim.sizeBytes).toBe(archive.sizeBytes);
    expect(claim.expiresInSeconds).toBeGreaterThan(3600);
    const [row] = await testDb.db
      .select({ claimedAt: files.claimedAt })
      .from(files)
      .where(eq(files.id, archive.fileId));
    expect(row.claimedAt).not.toBeNull();
  });

  it("refuses an archive that is not the caller's, not an archive, or one a work names", async () => {
    const d = makeDeps();
    const photo = await uploadTestPhoto(d.deps, { seed: 2 });
    const named = await uploadTestArchive(d.deps, "named");
    await createWork(d.deps, {
      name: "Z archiwum",
      imageFileIds: [photo.original.fileId],
      r360FileId: named.fileId,
    });
    await expect(
      claimArchive(d.deps, { fileId: named.fileId }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      claimArchive(d.deps, { fileId: photo.original.fileId }),
    ).rejects.toMatchObject({ code: "not_found" });
    const other = await insertTestAccount(testDb.db, {
      email: "other-resume@example.com",
    });
    const theirs = await uploadTestArchive({ ...d.deps, userId: other }, "x");
    await expect(
      claimArchive(d.deps, { fileId: theirs.fileId }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("a claimed archive survives the orphan sweep while the claim is fresh", async () => {
    const d = makeDeps();
    const archive = await uploadTestArchive(d.deps, "one");
    await testDb.db
      .update(files)
      .set({ createdAt: sql`now() - interval '25 hours'` })
      .where(eq(files.id, archive.fileId));
    await claimArchive(d.deps, { fileId: archive.fileId });
    await sweepOrphanArchives(d.deps);
    expect(d.objects.has(archive.key)).toBe(true);
    // Past the ceiling the sweep takes it, claimed or not.
    await testDb.db
      .update(files)
      .set({ createdAt: sql`now() - interval '8 days'` })
      .where(eq(files.id, archive.fileId));
    await claimArchive(d.deps, { fileId: archive.fileId });
    await sweepOrphanArchives(d.deps);
    expect(d.objects.has(archive.key)).toBe(false);
    const again = await uploadTestArchive(d.deps, "again");
    await testDb.db
      .update(files)
      .set({ createdAt: sql`now() - interval '25 hours'` })
      .where(eq(files.id, again.fileId));
    await claimArchive(d.deps, { fileId: again.fileId });
    // A claim that went stale holds nothing back.
    await testDb.db
      .update(files)
      .set({ claimedAt: sql`now() - interval '7 hours'` })
      .where(eq(files.id, again.fileId));
    await sweepOrphanArchives(d.deps);
    expect(d.objects.has(again.key)).toBe(false);
  });
});

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { files } from "@/db/schema";
import { requireEnv } from "@/lib/env";
import { getStorage, keyPrefix } from "@/lib/storage";

// pnpm db:drop-r360-archives — the one-off half of #120.
//
// The R360 zip is no longer uploaded: it is read on the owner's machine and
// stays there. Every archive an environment already holds is therefore
// unreachable — no column names it once migration 0017 has run, and no code
// path would ever free it.
//
// The migration deletes the ROWS, because a row nothing can name is a lie in
// the quota. It cannot delete the OBJECTS: SQL has no reach into the bucket,
// and G2 says objects are freed through code. So this runs once per
// environment, BEFORE the migration reaches it, and takes the objects out
// while their rows still say where they are.
//
// Safe to run twice: the second pass finds no rows. Safe to run late, too —
// after the migration there are no rows left and the objects would have to be
// found by prefix instead, which is what the log below warns about.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function loadDotEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

// The same guard as db:seed (#17) and the #49 backfill: every legitimate
// target answers on loopback — the SSH tunnel of SPEC.md §3, a local
// Postgres, CI's service container. Anything else is somebody's real
// database until the run says so out loud. This one DELETES, so it matters.
function assertLocalTarget(url: string, allowRemote: boolean): void {
  if (allowRemote) return;
  const host = new URL(url).hostname;
  if (LOOPBACK_HOSTS.has(host)) return;
  throw new Error(
    `refusing to delete from a non-loopback database (${host}); pass --allow-remote if that is really the target`,
  );
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main(): Promise<void> {
  loadDotEnv();
  const url = requireEnv("DATABASE_URL");
  assertLocalTarget(url, process.argv.includes("--allow-remote"));
  const dryRun = process.argv.includes("--dry-run");

  const prefix = keyPrefix();
  console.log(prefix === "" ? "S3_PREFIX is blank" : `S3_PREFIX "${prefix}"`);

  const db = getDb();
  const archives = await db
    .select({
      id: files.id,
      objectKey: files.objectKey,
      sizeBytes: files.sizeBytes,
      userId: files.userId,
    })
    .from(files)
    .where(eq(files.kind, "r360-zip"));

  if (archives.length === 0) {
    console.log("nothing to do — this environment holds no R360 archives");
    return;
  }
  const total = archives.reduce((sum, row) => sum + row.sizeBytes, 0);
  console.log(
    `${archives.length} archive(s), ${megabytes(total)} across ${new Set(archives.map((row) => row.userId)).size} account(s)`,
  );

  const storage = getStorage();
  let removed = 0;
  for (const archive of archives) {
    if (!archive.objectKey) {
      // A row written before #49 never recorded its key; its object can
      // only be found by hand, so say which one and leave it.
      console.warn(`  ${archive.id}: no object key recorded — object left`);
      continue;
    }
    console.log(
      `  ${dryRun ? "would remove" : "removing"} ${archive.objectKey} (${megabytes(archive.sizeBytes)})`,
    );
    if (dryRun) continue;
    // Best effort per object: one that is already gone must not stop the
    // rest, and the row is what the quota counts.
    try {
      await storage.deleteObject(archive.objectKey);
    } catch (error) {
      console.warn(`  ${archive.objectKey}: ${(error as Error).message}`);
    }
    await db.delete(files).where(eq(files.id, archive.id));
    removed += 1;
  }
  console.log(
    dryRun
      ? "dry run — nothing was touched"
      : `done: ${removed} archive(s) gone, ${megabytes(total)} back off the quota`,
  );
}

await main();

import { eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, runAsBatchJob } from "@/db/client";
import { files } from "@/db/schema";
import { requireEnv } from "@/lib/env";
import { contentKey, keyPrefix } from "@/lib/storage";

// pnpm db:backfill-file-keys — the one-off half of #49.
//
// `files.object_key` records the key a row's object was written under. Rows
// that predate the column have none, and the reading code falls back to
// rebuilding the address from this environment's S3_PREFIX — which is the
// bug, everywhere except the environment that wrote them.
//
// Only THAT environment can fill them in, because only it knows which prefix
// its own uploads used. So this runs once per environment, against its own
// database and with its own S3_PREFIX, and afterwards the fallback is dead
// code for real data.
//
// Production has no rows to fix: it has not launched. Dev has Dawid's test
// accounts, and PR previews share dev's database — after this runs on dev,
// a preview resolves dev's objects, which is the whole point.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function loadDotEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

// The same guard as db:seed (#17): every legitimate target answers on
// loopback — the SSH tunnel of SPEC.md §3, a local Postgres, CI's service
// container. Anything else is somebody's real database until the run says so
// out loud. This one WRITES to every file row, so the guard matters more here
// than it does for a seed.
function assertLocalTarget(url: string, allowRemote: boolean): void {
  if (allowRemote) return;
  const host = new URL(url).hostname;
  if (LOOPBACK_HOSTS.has(host)) return;
  throw new Error(
    `refusing to write to a non-loopback database (${host}); pass --allow-remote if that is really the target`,
  );
}

async function main(): Promise<void> {
  // #172: one pass over every file row, allowed to take as long as it takes.
  runAsBatchJob();
  loadDotEnv();
  const url = requireEnv("DATABASE_URL");
  assertLocalTarget(url, process.argv.includes("--allow-remote"));

  const prefix = keyPrefix();
  console.log(
    prefix === ""
      ? "S3_PREFIX is blank — assuming the bucket root (SPEC §4 reserves that for production)"
      : `S3_PREFIX "${prefix}"`,
  );

  const db = getDb();
  // A variant's object is named after its PARENT's hash, so the parent row
  // has to come along.
  const parent = alias(files, "parent");
  const pending = await db
    .select({
      id: files.id,
      sha256: files.sha256,
      ext: files.ext,
      kind: files.kind,
      parentSha256: parent.sha256,
    })
    .from(files)
    .leftJoin(parent, eq(parent.id, files.parentFileId))
    .where(isNull(files.objectKey));

  if (pending.length === 0) {
    console.log("nothing to do — every file row already names its object");
    return;
  }

  for (const row of pending) {
    // The #12 naming contract, applied once and then never again: an original
    // is keyed by its own hash, a variant by its PARENT's hash plus the size
    // its kind names.
    const key =
      row.kind === "avatar-original"
        ? contentKey(row.sha256, row.ext, prefix)
        : contentKey(
            `${row.parentSha256}-${row.kind === "avatar-512" ? 512 : 128}`,
            "webp",
            prefix,
          );
    await db.update(files).set({ objectKey: key }).where(eq(files.id, row.id));
  }

  console.log(`filled ${pending.length} file row(s)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

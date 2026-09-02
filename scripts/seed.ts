import { getDb } from "@/db/client";
import { requireEnv } from "@/lib/env";
import { getStorage, isStorageConfigured, keyPrefix } from "@/lib/storage";
import {
  SEED_PASSWORD,
  SEED_PROFILES,
  seedProfiles,
  type SeedSummary,
} from "./seed-profiles";

// pnpm db:seed — the CLI around scripts/seed-profiles.ts (#17, G7). Thin on
// purpose: environment in, summary out; the data and the logic live in the
// module the integration suite covers (src/db/seed.test.ts).

// Every legitimate target answers on loopback: the SSH tunnel (SPEC.md §3,
// localhost:5433), a local Postgres, the CI service container. Any other host
// is somebody's real database until the run says --allow-remote.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

// Like next dev and drizzle-kit, read .env when there is one. Variables
// already in the environment win, so `DATABASE_URL=... pnpm db:seed` targets
// another database while .env still points at the tunnel.
function loadDotEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

// Where the photos go, said before anything is written: the SPEC.md §4
// prefix — or a warning when it is blank, because that layout is production's.
function announcePhotoDestination(prefix: string): void {
  if (prefix === "") {
    console.warn(
      "photos in the bucket root (S3_PREFIX is blank — SPEC §4 reserves that layout for production)",
    );
    return;
  }
  console.log(`photos under S3_PREFIX "${prefix}"`);
}

function printSummary(summary: SeedSummary): void {
  const photos = new Set(summary.photos);
  const skipped = new Set(summary.skipped);
  const photoCell = (handle: string): string => {
    if (skipped.has(handle)) return "— (skipped)";
    return photos.has(handle) ? "yes" : "no";
  };
  const handleWidth = Math.max(...SEED_PROFILES.map((p) => p.handle.length));
  const emailWidth = Math.max(...SEED_PROFILES.map((p) => p.email.length));
  console.log("");
  console.log(
    `${"handle".padEnd(handleWidth)}  ${"e-mail".padEnd(emailWidth)}  photo`,
  );
  for (const profile of SEED_PROFILES) {
    console.log(
      `${profile.handle.padEnd(handleWidth)}  ${profile.email.padEnd(emailWidth)}  ${photoCell(profile.handle)}`,
    );
  }
  console.log("");
  console.log(
    `created ${summary.created.length}, skipped ${summary.skipped.length}, photos ${summary.photos.length}`,
  );
  console.log(`Password for every seed account: ${SEED_PASSWORD}`);
}

async function main(argv: readonly string[]): Promise<number> {
  loadDotEnv();
  // Sample accounts with one published password belong in dev and test
  // databases only. The loopback check below is the guard; this is the belt.
  if (process.env.NODE_ENV === "production") {
    console.error("db:seed refuses to run with NODE_ENV=production.");
    return 1;
  }
  // Parsed, not connected: the refusal costs no round-trip.
  const target = new URL(requireEnv("DATABASE_URL"));
  const database = `${target.host}${target.pathname}`;
  if (
    !LOOPBACK_HOSTS.has(target.hostname) &&
    !argv.includes("--allow-remote")
  ) {
    console.error(
      `db:seed refuses the non-loopback database ${database} — pass --allow-remote to seed it anyway.`,
    );
    return 1;
  }
  console.log(`database ${database}`);

  const storage = isStorageConfigured() ? getStorage() : null;
  const prefix = keyPrefix();
  if (storage) {
    announcePhotoDestination(prefix);
  } else {
    console.log(
      "S3_* not set: seeding accounts, names and handles without photos.",
    );
  }
  const summary = await seedProfiles({
    db: getDb(),
    storage,
    prefix,
    log: (line) => console.log(line),
  });
  printSummary(summary);
  return 0;
}

// process.exit, not exitCode: the pg pool would otherwise keep the process
// alive until its idle clients time out.
main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

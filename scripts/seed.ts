import { getDb } from "@/db/client";
import { getStorage, keyPrefix } from "@/lib/storage";
import {
  SEED_PASSWORD,
  SEED_PROFILES,
  seedProfiles,
  type SeedSummary,
} from "./seed-profiles";

// pnpm db:seed — the CLI around scripts/seed-profiles.ts (#17, G7). Thin on
// purpose: environment in, summary out; the data and the logic live in the
// module the integration suite covers (src/db/seed.test.ts).

const S3_VARIABLES = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_KEY",
  "S3_SECRET",
];

// Like next dev and drizzle-kit, read .env when there is one. Variables
// already in the environment win, so `DATABASE_URL=... pnpm db:seed` targets
// the local runner while .env still points at the tunnel.
function loadDotEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function printSummary(summary: SeedSummary): void {
  const photos = new Set(summary.photos);
  const skipped = new Set(summary.skipped);
  const handleWidth = Math.max(...SEED_PROFILES.map((p) => p.handle.length));
  const emailWidth = Math.max(...SEED_PROFILES.map((p) => p.email.length));
  console.log("");
  console.log(
    `${"handle".padEnd(handleWidth)}  ${"e-mail".padEnd(emailWidth)}  photo`,
  );
  for (const profile of SEED_PROFILES) {
    const photo = skipped.has(profile.handle)
      ? "— (skipped)"
      : photos.has(profile.handle)
        ? "yes"
        : "no";
    console.log(
      `${profile.handle.padEnd(handleWidth)}  ${profile.email.padEnd(emailWidth)}  ${photo}`,
    );
  }
  console.log("");
  console.log(
    `created ${summary.created.length}, skipped ${summary.skipped.length}, photos ${summary.photos.length}`,
  );
  console.log(`Password for every seed account: ${SEED_PASSWORD}`);
}

async function main(): Promise<number> {
  loadDotEnv();
  // Sample accounts with one published password belong in dev and test
  // databases only.
  if (process.env.NODE_ENV === "production") {
    console.error("db:seed refuses to run with NODE_ENV=production.");
    return 1;
  }

  const s3Configured = S3_VARIABLES.every((name) => process.env[name]?.trim());
  if (!s3Configured) {
    console.log(
      "S3_* not set: seeding accounts, names and handles without photos.",
    );
  }
  const summary = await seedProfiles({
    db: getDb(),
    storage: s3Configured ? getStorage() : null,
    prefix: keyPrefix(),
    log: (line) => console.log(line),
  });
  printSummary(summary);
  return 0;
}

// process.exit, not exitCode: the pg pool would otherwise keep the process
// alive until its idle clients time out.
main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

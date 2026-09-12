// Runs INSIDE the production image, before the new container starts serving
// (#53). Plain .mjs, not TypeScript: the runtime layer carries no toolchain,
// and the point of this file is that it needs none.
//
// Why it exists: a deployment used to ship new code and leave the schema to
// whoever remembered. On 06.09.2026 that gap put dev on new code against an
// old schema — every profile page 500'd for ten minutes, with CI green and
// the container healthy, because nothing in the deployment had ever looked at
// the database. `docs/dev-environment.md` still describes the manual route,
// which stays the way a developer migrates their own database through the
// tunnel; this is how an ENVIRONMENT gets migrated.
//
// deploy/remote-deploy.sh runs it between `pull` and `up`, so a migration
// that fails leaves the previous container serving and the previous schema
// intact.

import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — refusing to guess at a database");
  process.exit(1);
}

// Sibling of this file in the image, copied there by the Dockerfile. Resolved
// from the module's own location rather than the working directory, so it
// does not matter where the container is invoked from.
const folder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "drizzle",
);

const pending = readdirSync(folder).filter((name) => name.endsWith(".sql"));
console.log(`${pending.length} migration file(s) in the image`);

// #172 deliberately does not reach this file: the web deadlines
// (statement_timeout, lock_timeout) live in the pool src/db/client.ts opens,
// not in DATABASE_URL, precisely so a migration is never cut off half-applied
// by a bound meant for a page. The one bound worth having here is the
// opposite one — a database that cannot be reached should fail the deploy
// rather than hold it open for ever.
// The lock bound is the exception, and it guards the SITE rather than the
// migration: the old container is still serving while this runs, and a
// migration waiting for ACCESS EXCLUSIVE queues every reader of that table
// behind itself. Better to fail the deploy in five seconds — old container
// serving, old schema untouched — than to stall the site for as long as
// whatever holds the table.
const pool = new Pool({
  connectionString: url,
  connectionTimeoutMillis: 30_000,
  lock_timeout: 5_000,
});
try {
  // Drizzle records what it has applied in its own table and skips those, so
  // this is safe to run on every deploy — including one that changes nothing.
  await migrate(drizzle(pool), { migrationsFolder: folder });
  console.log("schema is up to date");
} catch (error) {
  // The message matters more than the stack here: this output is what an
  // operator reads out of a failed deploy.
  console.error(
    "migration failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}

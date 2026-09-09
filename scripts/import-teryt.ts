import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { places } from "@/db/schema";
import { requireEnv } from "@/lib/env";
import {
  buildPlaces,
  csvFromZip,
  downloadTerytZip,
  parseCsv,
  type PlaceRow,
} from "./teryt-source";

// #87: fills the `places` table from the GUS TERYT registers.
//
//   pnpm db:import-teryt                      downloads TERC and SIMC
//   pnpm db:import-teryt --terc a.zip --simc b.zip   from files on disk
//   ... --allow-remote                        against a non-loopback database
//
// Idempotent: rows are upserted by code; rows the registers no longer
// carry (an older as_of after a full import) are deleted at the end.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function loadDotEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function importPlaces(
  db: Database,
  rows: PlaceRow[],
  log: (line: string) => void = () => undefined,
): Promise<{ upserted: number; deleted: number }> {
  const asOf = rows.reduce((max, r) => (r.asOf > max ? r.asOf : max), "");
  let upserted = 0;
  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db
      .insert(places)
      .values(batch)
      .onConflictDoUpdate({
        target: places.code,
        set: {
          kind: sql`excluded.kind`,
          rank: sql`excluded.rank`,
          name: sql`excluded.name`,
          nameFolded: sql`excluded.name_folded`,
          commune: sql`excluded.commune`,
          county: sql`excluded.county`,
          countyKind: sql`excluded.county_kind`,
          voivodeship: sql`excluded.voivodeship`,
          asOf: sql`excluded.as_of`,
        },
      });
    upserted += batch.length;
    if ((i / BATCH) % 20 === 0) log(`  ${upserted} / ${rows.length}`);
  }
  // Gone from the registers: everything this import did not touch.
  const gone = await db
    .delete(places)
    .where(sql`${places.asOf} < ${asOf}`)
    .returning({ code: places.code });
  return { upserted, deleted: gone.length };
}

async function main(argv: readonly string[]): Promise<number> {
  loadDotEnv();
  const target = new URL(requireEnv("DATABASE_URL"));
  if (
    !LOOPBACK_HOSTS.has(target.hostname) &&
    !argv.includes("--allow-remote")
  ) {
    console.error(
      `db:import-teryt refuses ${target.host}${target.pathname}: not loopback. Pass --allow-remote if that is the intended database.`,
    );
    return 1;
  }
  const arg = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const source = async (file: "TERC" | "SIMC"): Promise<string> => {
    const path = arg(`--${file.toLowerCase()}`);
    if (path) {
      console.log(`${file}: ${path}`);
      return csvFromZip(readFileSync(path));
    }
    console.log(`${file}: downloading from eteryt.stat.gov.pl…`);
    const { zip, filename } = await downloadTerytZip(file);
    console.log(`${file}: ${filename}, ${zip.length} bytes`);
    return csvFromZip(zip);
  };
  const terc = parseCsv(await source("TERC"));
  const simc = parseCsv(await source("SIMC"));
  const rows = buildPlaces(terc, simc);
  const byKind = new Map<string, number>();
  for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
  console.log(
    `${rows.length} places: ${[...byKind].map(([k, n]) => `${k} ${n}`).join(", ")}`,
  );
  const result = await importPlaces(getDb(), rows, console.log);
  console.log(`upserted ${result.upserted}, deleted ${result.deleted}`);
  return 0;
}

if (process.argv[1]?.endsWith("import-teryt.ts")) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}

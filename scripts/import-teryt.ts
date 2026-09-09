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

/** The registers hold ~105 000 places; a run that would leave far fewer
 * has read a broken file, and must not delete the rest (review). */
export const PLACES_FLOOR = 90_000;

export async function importPlaces(
  db: Database,
  rows: PlaceRow[],
  log: (line: string) => void = () => undefined,
  options: { floor?: number } = {},
): Promise<{ upserted: number; deleted: number }> {
  const floor = options.floor ?? PLACES_FLOOR;
  if (rows.length < floor) {
    throw new Error(
      `only ${rows.length} places read, below the floor of ${floor}: refusing to import (pass --allow-partial for a known-partial set)`,
    );
  }
  if (rows.length === 0) throw new Error("nothing to import");
  // Each register on its own date: TERC (the units, codes w/p/g) and SIMC
  // (the localities, codes s) are two files, fetched or given separately,
  // and can carry different "stan na" dates. A row goes when its own
  // register has moved past it — never because the other one has.
  const cutoff = { units: "", localities: "" };
  for (const r of rows) {
    const key = r.code.startsWith("s") ? "localities" : "units";
    if (r.asOf > cutoff[key]) cutoff[key] = r.asOf;
  }
  const BATCH = 1000;
  return db.transaction(async (tx) => {
    let upserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      await tx
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
    let deleted = 0;
    if (cutoff.units) {
      const gone = await tx
        .delete(places)
        .where(
          sql`left(${places.code}, 1) IN ('w', 'p', 'g') AND ${places.asOf} < ${cutoff.units}`,
        )
        .returning({ code: places.code });
      deleted += gone.length;
    }
    if (cutoff.localities) {
      const gone = await tx
        .delete(places)
        .where(
          sql`left(${places.code}, 1) = 's' AND ${places.asOf} < ${cutoff.localities}`,
        )
        .returning({ code: places.code });
      deleted += gone.length;
    }
    return { upserted, deleted };
  });
}

async function main(argv: readonly string[]): Promise<number> {
  loadDotEnv();
  const target = new URL(requireEnv("DATABASE_URL"));
  const database = `${target.host}${target.pathname}`;
  if (
    !LOOPBACK_HOSTS.has(target.hostname) &&
    !argv.includes("--allow-remote")
  ) {
    console.error(
      `db:import-teryt refuses ${database}: not loopback. Pass --allow-remote if that is the intended database.`,
    );
    return 1;
  }
  console.log(`database: ${database}`);
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
  const result = await importPlaces(getDb(), rows, console.log, {
    floor: argv.includes("--allow-partial") ? 0 : undefined,
  });
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

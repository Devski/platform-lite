import { and, asc, eq, inArray, not, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { places } from "@/db/schema";

// #87 / A12: the places a profile can name — every locality in Poland,
// from the GUS TERYT registers (TERC for the units, SIMC for the
// localities), imported into the `places` table by scripts/import-teryt.ts
// and searched here, on the server: 100 000 rows do not ship to a browser.
// A place the table does not know is still allowed (free text), so the
// list only has to be good, never complete.

export type PlaceKind =
  | "voivodeship"
  | "county"
  | "commune"
  | "city"
  | "village"
  | "settlement"
  | "part";

export interface Place {
  name: string;
  kind: PlaceKind;
  /** The commune the locality lies in (not for the units themselves). */
  commune?: string;
  /** The county: "oświęcimski" for a powiat, "Kraków" for a city county. */
  county?: string;
  countyKind?: "county" | "cityCounty";
  /** Lowercase, as the register spells it: "małopolskie". */
  voivodeship?: string;
}

/** Whole places first, parts of them last: a village wins over the hamlet
 * named after it, a city over the district. */
export const PLACE_RANK: Record<PlaceKind, number> = {
  voivodeship: 0,
  county: 1,
  city: 2,
  commune: 3,
  village: 4,
  settlement: 5,
  part: 6,
};

// What both sides of a match are reduced to: lowercase, no diacritics, so
// "lodz" finds Łódź and "SWIETOKRZYSKIE" the voivodeship. Ł is not a base
// letter plus a mark in Unicode, hence the explicit fold.
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase()
    .trim();
}

export const PLACE_QUERY_MIN = 2;

/**
 * Places whose name starts with the query (folded), larger units first and
 * parts of localities last, then by name — at most `limit`, none whose
 * name is in `exclude` (the chips already on the profile). A query shorter
 * than PLACE_QUERY_MIN yields nothing: the list is a suggestion box.
 */
export async function searchPlaces(
  db: Database,
  query: string,
  options: { exclude?: readonly string[]; limit?: number } = {},
): Promise<Place[]> {
  const folded = foldForSearch(query);
  if (folded.length < PLACE_QUERY_MIN) return [];
  const limit = Math.min(options.limit ?? 10, 25);
  const excluded = [...new Set((options.exclude ?? []).map(foldForSearch))];
  // The prefix as a LIKE pattern, its own wildcards escaped; the index on
  // name_folded (text_pattern_ops) serves it.
  const pattern = `${folded.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db
    .select({
      name: places.name,
      kind: places.kind,
      commune: places.commune,
      county: places.county,
      countyKind: places.countyKind,
      voivodeship: places.voivodeship,
    })
    .from(places)
    .where(
      and(
        sql`${places.nameFolded} LIKE ${pattern}`,
        excluded.length > 0
          ? not(inArray(places.nameFolded, excluded))
          : undefined,
      ),
    )
    .orderBy(
      asc(places.rank),
      asc(places.nameFolded),
      asc(places.voivodeship),
      asc(places.county),
    )
    .limit(limit);
  return rows.map((row) => ({
    name: row.name,
    kind: row.kind,
    ...(row.commune ? { commune: row.commune } : {}),
    ...(row.county ? { county: row.county } : {}),
    ...(row.countyKind ? { countyKind: row.countyKind } : {}),
    ...(row.voivodeship ? { voivodeship: row.voivodeship } : {}),
  }));
}

/** The 16 voivodeships, in the register's order. */
export async function listVoivodeships(db: Database): Promise<string[]> {
  const rows = await db
    .select({ name: places.name })
    .from(places)
    .where(eq(places.kind, "voivodeship"))
    .orderBy(asc(places.nameFolded));
  return rows.map((row) => row.name);
}

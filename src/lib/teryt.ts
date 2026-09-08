import data from "@/data/teryt-places.json";

// #72 / A12: the places a profile can name. The list is the 16 voivodeships
// and every town with city rights, as the GUS TERYT register has them —
// bundled, not fetched: a geocoding service would be a new dependency and a
// new cost (§7), and most of them forbid autocomplete use anyway. The data
// file names its source and date. A place the list does not know is still
// allowed (free text), so the list only has to be good, never complete.
//
// Imported lazily by the one field that needs it (the owner's place
// combobox, on first focus), so the 39 KB never reach a visitor.

export type PlaceKind = "voivodeship" | "city";

export interface Place {
  name: string;
  kind: PlaceKind;
  /** For a city: the voivodeship it lies in — what tells two Józefóws apart. */
  voivodeship?: string;
}

export const VOIVODESHIPS: readonly string[] = data.voivodeships;

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

// Folded once at load, not per keystroke: a search walks every entry.
const PLACES: readonly (Place & { folded: string })[] = [
  ...data.voivodeships.map((name) => ({ name, kind: "voivodeship" as const })),
  ...data.cities.map((city) => ({
    name: city.n,
    kind: "city" as const,
    voivodeship: city.v,
  })),
].map((place) => ({ ...place, folded: foldForSearch(place.name) }));

/**
 * Places whose name starts with the query, voivodeships first, then cities
 * in alphabetical order — at most `limit`, none whose name is in `exclude`
 * (the chips already on the profile, compared folded). An empty query
 * yields nothing: the list is a suggestion box, not a browser.
 */
export function searchPlaces(
  query: string,
  options: { exclude?: readonly string[]; limit?: number } = {},
): Place[] {
  const folded = foldForSearch(query);
  if (!folded) return [];
  const limit = options.limit ?? 8;
  const excluded = new Set((options.exclude ?? []).map(foldForSearch));
  const hits: Place[] = [];
  for (const place of PLACES) {
    if (!place.folded.startsWith(folded) || excluded.has(place.folded)) {
      continue;
    }
    hits.push({
      name: place.name,
      kind: place.kind,
      ...(place.voivodeship ? { voivodeship: place.voivodeship } : {}),
    });
    if (hits.length === limit) break;
  }
  return hits;
}

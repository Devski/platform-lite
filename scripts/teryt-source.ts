import { inflateRawSync } from "node:zlib";
import type { PlaceKind } from "@/lib/places";
import { foldForSearch, PLACE_RANK } from "@/lib/places";

// #87: the GUS TERYT registers as the platform reads them. Two files from
// eteryt.stat.gov.pl — TERC (the units: voivodeships, counties, communes)
// and SIMC (the localities) — published as CSV inside a zip, fetched by
// replaying the page's own form (there is no direct link), and turned
// into the rows of the `places` table. Pure functions here; the script
// in import-teryt.ts does the talking to the database.

export const TERYT_PAGE =
  "https://eteryt.stat.gov.pl/eTeryt/rejestr_teryt/udostepnianie_danych/baza_teryt/uzytkownicy_indywidualni/pobieranie/pliki_pelne.aspx?contrast=default";

const BUTTONS = {
  TERC: "ctl00$body$BTERCUrzedowyPobierz",
  SIMC: "ctl00$body$BSIMCUrzedowyPobierz",
} as const;

export type TerytFile = keyof typeof BUTTONS;

/**
 * Downloads one register's full file (a zip with a CSV and an XML) from
 * the official page: the page is an ASP.NET form, so the hidden fields
 * are read from a first GET and posted back with the button's name.
 */
export async function downloadTerytZip(
  file: TerytFile,
  fetchImpl: typeof fetch = fetch,
): Promise<{ zip: Buffer; filename: string }> {
  const page = await fetchImpl(TERYT_PAGE, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!page.ok) throw new Error(`TERYT page answered ${page.status}`);
  const cookie = (page.headers.get("set-cookie") ?? "")
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
  const html = await page.text();
  const field = (name: string): string => {
    const tag = html.match(
      new RegExp(`<input[^>]+name="${name.replace(/\$/g, "\\$")}"[^>]*>`),
    );
    return tag?.[0].match(/value="([^"]*)"/)?.[1] ?? "";
  };
  const body = new URLSearchParams();
  body.set("__EVENTTARGET", BUTTONS[file]);
  body.set("__EVENTARGUMENT", "");
  for (const name of [
    "__VIEWSTATE",
    "__VIEWSTATEGENERATOR",
    "__EVENTVALIDATION",
  ]) {
    body.set(name, field(name));
  }
  body.set("ctl00$body$TBData", field("ctl00$body$TBData"));
  const response = await fetchImpl(TERYT_PAGE, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body,
    signal: AbortSignal.timeout(300_000),
  });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("zip")) {
    throw new Error(
      `TERYT ${file} download answered ${response.status} ${type}`,
    );
  }
  const filename =
    response.headers
      .get("content-disposition")
      ?.match(/filename=([^;]+)/)?.[1] ?? `${file}.zip`;
  return { zip: Buffer.from(await response.arrayBuffer()), filename };
}

/**
 * The CSV out of a TERYT zip. A minimal reader — the central directory,
 * then the one entry that ends in .csv, stored or deflated — so the
 * import needs no zip dependency for two files a year.
 */
export function csvFromZip(zip: Buffer): string {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("not a zip: no end of central directory");
  const entries = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("bad central entry");
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;
    if (!name.toLowerCase().endsWith(".csv")) continue;
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = zip.subarray(start, start + compressedSize);
    const bytes =
      method === 0 ? data : method === 8 ? inflateRawSync(data) : null;
    if (!bytes)
      throw new Error(`zip entry ${name}: unsupported method ${method}`);
    return bytes.toString("utf8").replace(/^﻿/, "");
  }
  throw new Error("no .csv entry in the zip");
}

/** Semicolon-separated, a header row, CRLF; TERYT quotes nothing. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.length > 0);
  const header = lines[0].split(";");
  return lines.slice(1).map((line) => {
    const cells = line.split(";");
    const row: Record<string, string> = {};
    header.forEach((key, i) => {
      row[key] = cells[i] ?? "";
    });
    return row;
  });
}

export interface PlaceRow {
  code: string;
  kind: PlaceKind;
  rank: number;
  name: string;
  nameFolded: string;
  commune: string | null;
  county: string | null;
  countyKind: "county" | "cityCounty" | null;
  voivodeship: string | null;
  asOf: string;
}

// SIMC "RM" — the kind of locality — as the register codes it.
const SIMC_KIND: Record<string, PlaceKind | undefined> = {
  "96": "city",
  "01": "village",
  "02": "settlement", // kolonia
  "03": "settlement", // przysiółek
  "04": "settlement", // osada
  "05": "settlement", // osada leśna
  "06": "settlement", // osiedle
  "07": "settlement", // schronisko turystyczne
  "00": "part", // część miejscowości
  "99": "part", // część miasta
  "95": "part", // dzielnica m.st. Warszawy
  "98": "part", // delegatura
};

/**
 * The rows for `places` out of the two registers: the 16 voivodeships,
 * the counties and the communes from TERC; every locality from SIMC, each
 * placed in its commune, county and voivodeship by the TERC codes it
 * carries. Sub-units of a mixed commune (the town and the rural area,
 * TERC kinds 4 and 5) and Warsaw's districts as units (8, 9) are not
 * places of their own here: the town is in SIMC, the districts are parts.
 */
export function buildPlaces(
  terc: Record<string, string>[],
  simc: Record<string, string>[],
): PlaceRow[] {
  const voivodeships = new Map<string, string>();
  const counties = new Map<
    string,
    { name: string; kind: "county" | "cityCounty" }
  >();
  const communes = new Map<string, string>();
  const rows: PlaceRow[] = [];
  const row = (partial: Omit<PlaceRow, "rank" | "nameFolded">): PlaceRow => ({
    ...partial,
    rank: PLACE_RANK[partial.kind],
    nameFolded: foldForSearch(partial.name),
  });

  for (const unit of terc) {
    const { WOJ, POW, GMI, RODZ, NAZWA, NAZWA_DOD, STAN_NA } = unit;
    if (!POW) {
      const name = NAZWA.toLowerCase();
      voivodeships.set(WOJ, name);
      rows.push(
        row({
          code: `w${WOJ}`,
          kind: "voivodeship",
          name,
          commune: null,
          county: null,
          countyKind: null,
          voivodeship: name,
          asOf: STAN_NA,
        }),
      );
    } else if (!GMI) {
      const kind = NAZWA_DOD.includes("prawach") ? "cityCounty" : "county";
      counties.set(WOJ + POW, { name: NAZWA, kind });
      rows.push(
        row({
          code: `p${WOJ}${POW}`,
          kind: "county",
          name: NAZWA,
          commune: null,
          county: null,
          countyKind: kind,
          voivodeship: voivodeships.get(WOJ) ?? null,
          asOf: STAN_NA,
        }),
      );
    } else if (RODZ === "1" || RODZ === "2" || RODZ === "3") {
      communes.set(WOJ + POW + GMI, NAZWA);
      const county = counties.get(WOJ + POW);
      rows.push(
        row({
          code: `g${WOJ}${POW}${GMI}${RODZ}`,
          kind: "commune",
          name: NAZWA,
          commune: null,
          county: county?.name ?? null,
          countyKind: county?.kind ?? null,
          voivodeship: voivodeships.get(WOJ) ?? null,
          asOf: STAN_NA,
        }),
      );
    }
  }

  for (const locality of simc) {
    const { WOJ, POW, GMI, RM, NAZWA, SYM, STAN_NA } = locality;
    const kind = SIMC_KIND[RM];
    if (!kind) continue;
    const county = counties.get(WOJ + POW);
    rows.push(
      row({
        code: `s${SYM}`,
        kind,
        name: NAZWA,
        commune: communes.get(WOJ + POW + GMI) ?? null,
        county: county?.name ?? null,
        countyKind: county?.kind ?? null,
        voivodeship: voivodeships.get(WOJ) ?? null,
        asOf: STAN_NA,
      }),
    );
  }
  return rows;
}

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { places } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-db";
import { buildPlaces, parseCsv } from "../../scripts/teryt-source";
import { importPlaces } from "../../scripts/import-teryt";
import { foldForSearch, listVoivodeships, searchPlaces } from "./places";

// #87 / A12: the place suggestions out of the `places` table — the prefix
// match without diacritics, the ranking (a whole place before a part of
// one, larger units first), the chips already on the profile left out,
// and the import that fills the table and keeps it in step.

let testDb: TestDb;

const TERC = [
  "WOJ;POW;GMI;RODZ;NAZWA;NAZWA_DOD;STAN_NA",
  "10;;;;ŁÓDZKIE;województwo;2026-01-01",
  "12;;;;MAŁOPOLSKIE;województwo;2026-01-01",
  "12;13;;;oświęcimski;powiat;2026-01-01",
  "12;61;;;Kraków;miasto na prawach powiatu;2026-01-01",
  "12;13;02;3;Kęty;gmina miejsko-wiejska;2026-01-01",
  "12;61;01;1;Kraków;gmina miejska;2026-01-01",
  "10;61;;;Łódź;miasto na prawach powiatu;2026-01-01",
  "10;61;01;1;Łódź;gmina miejska;2026-01-01",
  "12;13;01;2;Nowa Wieś;gmina wiejska;2026-01-01",
].join("\n");

const SIMC = [
  "WOJ;POW;GMI;RODZ_GMI;RM;MZ;NAZWA;SYM;SYMPOD;STAN_NA",
  "12;13;02;5;01;1;Nowa Wieś;0060612;0060612;2026-01-01",
  "12;61;01;1;01;1;Nowa Wieś;0060613;0060613;2026-01-01",
  "12;13;02;5;00;1;Nowa Wieś Górna;0060665;0060612;2026-01-01",
  "12;61;01;1;96;1;Kraków;0950463;0950463;2026-01-01",
  "10;61;01;1;96;1;Łódź;0957000;0957000;2026-01-01",
  "12;13;02;4;96;1;Kęty;0932575;0932575;2026-01-01",
].join("\n");

beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.close();
});
beforeEach(async () => {
  await testDb.reset();
  await importPlaces(testDb.db, buildPlaces(parseCsv(TERC), parseCsv(SIMC)));
});

describe("foldForSearch", () => {
  it("drops diacritics, folds ł, lowercases and trims", () => {
    expect(foldForSearch("  Łódź ")).toBe("lodz");
    expect(foldForSearch("ŚWIĘTOKRZYSKIE")).toBe("swietokrzyskie");
    expect(foldForSearch("Zielona Góra")).toBe("zielona gora");
  });
});

describe("searchPlaces", () => {
  it("matches the start of the name without diacritics, larger units first, then whole places, parts last", async () => {
    const hits = await searchPlaces(testDb.db, "nowa w");
    expect(hits.map((p) => [p.kind, p.name, p.county])).toEqual([
      ["commune", "Nowa Wieś", "oświęcimski"],
      ["village", "Nowa Wieś", "Kraków"],
      ["village", "Nowa Wieś", "oświęcimski"],
      ["part", "Nowa Wieś Górna", "oświęcimski"],
    ]);
    // Two villages of one name are told apart by where they lie.
    expect(hits[1]).toEqual({
      name: "Nowa Wieś",
      kind: "village",
      commune: "Kraków",
      county: "Kraków",
      countyKind: "cityCounty",
      voivodeship: "małopolskie",
    });
  });

  it("finds Łódź from 'lodz' — the voivodeship, the county, the commune and the city, in that order", async () => {
    const hits = await searchPlaces(testDb.db, "lodz");
    expect(hits.map((p) => `${p.kind}:${p.name}`)).toEqual([
      "voivodeship:łódzkie",
      "county:Łódź",
      "city:Łódź",
      "commune:Łódź",
    ]);
  });

  it("leaves out the names already on the profile, caps the list, and asks for two letters", async () => {
    expect(
      (await searchPlaces(testDb.db, "nowa", { exclude: ["nowa wieś"] })).map(
        (p) => p.name,
      ),
    ).toEqual(["Nowa Wieś Górna"]);
    expect(await searchPlaces(testDb.db, "n", {})).toEqual([]);
    expect(await searchPlaces(testDb.db, "  ", {})).toEqual([]);
    expect(await searchPlaces(testDb.db, "nowa", { limit: 2 })).toHaveLength(2);
  });

  it("treats LIKE's wildcards in the query as letters", async () => {
    expect(await searchPlaces(testDb.db, "%")).toEqual([]);
    expect(await searchPlaces(testDb.db, "n_wa")).toEqual([]);
  });

  it("lists the voivodeships", async () => {
    expect(await listVoivodeships(testDb.db)).toEqual([
      "łódzkie",
      "małopolskie",
    ]);
  });
});

describe("importPlaces", () => {
  it("upserts by code and drops what a newer register no longer carries", async () => {
    const before = await testDb.db.select().from(places);
    expect(before).toHaveLength(9 + 6);
    // The next year's registers: Kęty renamed, one village gone.
    const terc2 = TERC.replace(/2026-01-01/g, "2027-01-01").replace(
      "12;13;02;3;Kęty;",
      "12;13;02;3;Kęty Nowe;",
    );
    const simc2 = SIMC.replace(/2026-01-01/g, "2027-01-01")
      .split("\n")
      .filter((line) => !line.includes("0060613"))
      .join("\n");
    const result = await importPlaces(
      testDb.db,
      buildPlaces(parseCsv(terc2), parseCsv(simc2)),
    );
    expect(result).toEqual({ upserted: 9 + 5, deleted: 1 });
    const after = await testDb.db.select().from(places);
    expect(after).toHaveLength(9 + 5);
    expect(after.find((r) => r.code === "g1213023")?.name).toBe("Kęty Nowe");
    expect(after.every((r) => r.asOf === "2027-01-01")).toBe(true);
  });
});

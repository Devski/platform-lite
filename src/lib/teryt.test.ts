import { describe, expect, it } from "vitest";
import { foldForSearch, searchPlaces, VOIVODESHIPS } from "./teryt";

// #72 / A12: the bundled TERYT list behind the place suggestions.

describe("the bundled list", () => {
  it("has the sixteen voivodeships, in Polish alphabetical order", () => {
    expect(VOIVODESHIPS).toHaveLength(16);
    expect(VOIVODESHIPS[0]).toBe("dolnośląskie");
    expect(VOIVODESHIPS).toContain("łódzkie");
    expect(VOIVODESHIPS[15]).toBe("zachodniopomorskie");
  });

  it("knows the big cities with their voivodeship, and tells two Józefóws apart", () => {
    expect(searchPlaces("Warszawa")).toEqual([
      { name: "Warszawa", kind: "city", voivodeship: "mazowieckie" },
    ]);
    // Three towns start with the name — Józefów twice (lubelskie, mazowieckie)
    // and Józefów nad Wisłą — and the voivodeship is what tells them apart.
    const jozefow = searchPlaces("Józefów").filter((p) => p.name === "Józefów");
    expect(jozefow.map((p) => p.voivodeship).sort()).toEqual([
      "lubelskie",
      "mazowieckie",
    ]);
  });
});

describe("foldForSearch", () => {
  it("drops diacritics, folds ł, lowercases and trims", () => {
    expect(foldForSearch("  Łódź ")).toBe("lodz");
    expect(foldForSearch("ŚWIĘTOKRZYSKIE")).toBe("swietokrzyskie");
    expect(foldForSearch("Zielona Góra")).toBe("zielona gora");
  });
});

describe("searchPlaces", () => {
  it("matches the start of the name without diacritics, voivodeships before cities", () => {
    const hits = searchPlaces("lodz");
    expect(hits[0]).toEqual({ name: "łódzkie", kind: "voivodeship" });
    expect(hits.some((p) => p.name === "Łódź" && p.kind === "city")).toBe(true);
  });

  it("caps the list, excludes what is already chosen, and yields nothing for an empty query", () => {
    expect(searchPlaces("s")).toHaveLength(8);
    expect(searchPlaces("s", { limit: 3 })).toHaveLength(3);
    expect(searchPlaces("Warszawa", { exclude: ["warszawa"] })).toEqual([]);
    expect(searchPlaces("")).toEqual([]);
    expect(searchPlaces("   ")).toEqual([]);
  });

  it("finds nothing for a place outside the list — free text is the form's business", () => {
    expect(searchPlaces("Berlin")).toEqual([]);
  });

  it("excludes what is already chosen however it was typed", () => {
    expect(
      searchPlaces("Łódź", { exclude: ["LODZ"] }).map((p) => p.name),
    ).not.toContain("Łódź");
    expect(
      searchPlaces("Łódź", { exclude: ["lodzkie"] }).map((p) => p.name),
    ).not.toContain("łódzkie");
  });

  it("the data file is consistent: every city names a known voivodeship, no pair twice", async () => {
    const data = (await import("@/data/teryt-places.json")).default;
    const known = new Set(data.voivodeships);
    const pairs = new Set<string>();
    for (const city of data.cities) {
      expect(known.has(city.v), city.n).toBe(true);
      expect(pairs.has(`${city.n}|${city.v}`), city.n).toBe(false);
      pairs.add(`${city.n}|${city.v}`);
    }
    expect(data.cities.length).toBeGreaterThan(900);
  });
});

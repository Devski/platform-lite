import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  buildPlaces,
  csvFromZip,
  downloadTerytZip,
  parseCsv,
} from "../../scripts/teryt-source";

// #87: the TERYT registers, read the way the import reads them — a zip's
// CSV entry, the semicolon rows, and the mapping of the two registers'
// codes onto the rows of `places`. Samples here are real rows from the
// files of 09.09.2026, trimmed.

const TERC = [
  "WOJ;POW;GMI;RODZ;NAZWA;NAZWA_DOD;STAN_NA",
  "12;;;;MAŁOPOLSKIE;województwo;2026-01-01",
  "12;13;;;oświęcimski;powiat;2026-01-01",
  "12;61;;;Kraków;miasto na prawach powiatu;2026-01-01",
  "12;13;02;3;Kęty;gmina miejsko-wiejska;2026-01-01",
  "12;13;02;4;Kęty;miasto;2026-01-01",
  "12;13;02;5;Kęty;obszar wiejski;2026-01-01",
  "12;61;01;1;Kraków;gmina miejska;2026-01-01",
  "14;;;;MAZOWIECKIE;województwo;2026-01-01",
  "14;65;;;Warszawa;miasto na prawach powiatu;2026-01-01",
  "14;65;01;1;Warszawa;gmina miejska;2026-01-01",
  "14;65;01;8;Bemowo;dzielnica;2026-01-01",
].join("\r\n");

const SIMC = [
  "WOJ;POW;GMI;RODZ_GMI;RM;MZ;NAZWA;SYM;SYMPOD;STAN_NA",
  "12;13;02;5;01;1;Nowa Wieś;0060612;0060612;2026-01-01",
  "12;13;02;4;96;1;Kęty;0932575;0932575;2026-01-01",
  "12;13;02;5;00;1;Podlesie;0060665;0060612;2026-01-01",
  "12;61;01;1;96;1;Kraków;0950463;0950463;2026-01-01",
  "12;61;01;1;99;1;Nowa Huta;0950470;0950463;2026-01-01",
  "14;65;01;1;96;1;Warszawa;0918123;0918123;2026-01-01",
  "14;65;01;8;95;1;Bemowo;0918130;0918123;2026-01-01",
  "12;13;02;5;03;1;Zagórze;0060700;0060612;2026-01-01",
].join("\r\n");

function zipWith(entries: { name: string; text: string }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const raw = Buffer.from(entry.text, "utf8");
    const data = deflateRawSync(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += local.length + name.length + data.length;
  }
  const centralBuffer = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuffer, eocd]);
}

describe("csvFromZip", () => {
  it("finds the CSV entry among others, inflates it and drops the BOM", () => {
    const zip = zipWith([
      { name: "TERC_Urzedowy_2026-09-09.xml", text: "<xml/>" },
      { name: "TERC_Urzedowy_2026-09-09.csv", text: "﻿" + TERC },
    ]);
    expect(csvFromZip(zip)).toBe(TERC);
  });

  it("refuses what is not a zip, or has no CSV", () => {
    expect(() => csvFromZip(Buffer.from("nope"))).toThrow(/not a zip/);
    expect(() => csvFromZip(zipWith([{ name: "a.xml", text: "" }]))).toThrow(
      /no \.csv/,
    );
  });
});

describe("parseCsv", () => {
  it("reads the header and the semicolon rows, BOM and CRLF included", () => {
    const rows = parseCsv("﻿" + SIMC);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({
      WOJ: "12",
      RM: "01",
      NAZWA: "Nowa Wieś",
      SYM: "0060612",
    });
  });
});

describe("buildPlaces", () => {
  const rows = buildPlaces(parseCsv(TERC), parseCsv(SIMC));
  const byCode = new Map(rows.map((r) => [r.code, r]));

  it("makes the voivodeships (lowercased), the counties with their kind, and the communes — not the sub-units or districts", () => {
    expect(byCode.get("w12")).toMatchObject({
      kind: "voivodeship",
      name: "małopolskie",
      nameFolded: "malopolskie",
      rank: 0,
    });
    expect(byCode.get("p1213")).toMatchObject({
      kind: "county",
      name: "oświęcimski",
      countyKind: "county",
      voivodeship: "małopolskie",
    });
    expect(byCode.get("p1261")).toMatchObject({
      kind: "county",
      name: "Kraków",
      countyKind: "cityCounty",
    });
    expect(byCode.get("g1213023")).toMatchObject({
      kind: "commune",
      name: "Kęty",
      county: "oświęcimski",
      voivodeship: "małopolskie",
    });
    // TERC kinds 4 and 5 (the town and the rural area of Kęty) and 8
    // (Bemowo as a unit) make no rows of their own.
    expect(rows.filter((r) => r.code.startsWith("g1213024"))).toHaveLength(0);
    expect(rows.filter((r) => r.kind === "commune").map((r) => r.name)).toEqual(
      ["Kęty", "Kraków", "Warszawa"],
    );
  });

  it("places every locality in its commune, county and voivodeship, ranked whole before part", () => {
    expect(byCode.get("s0060612")).toEqual({
      code: "s0060612",
      kind: "village",
      rank: 4,
      name: "Nowa Wieś",
      nameFolded: "nowa wies",
      commune: "Kęty",
      county: "oświęcimski",
      countyKind: "county",
      voivodeship: "małopolskie",
      asOf: "2026-01-01",
    });
    expect(byCode.get("s0932575")).toMatchObject({ kind: "city", rank: 2 });
    expect(byCode.get("s0060665")).toMatchObject({ kind: "part", rank: 6 });
    expect(byCode.get("s0060700")).toMatchObject({
      kind: "settlement",
      rank: 5,
    });
    expect(byCode.get("s0950470")).toMatchObject({
      kind: "part",
      name: "Nowa Huta",
      county: "Kraków",
      countyKind: "cityCounty",
    });
    expect(byCode.get("s0918130")).toMatchObject({
      kind: "part",
      name: "Bemowo",
    });
    expect(rows).toHaveLength(8 + 8);
  });
});

describe("downloadTerytZip", () => {
  it("reads the form's hidden fields from the page and posts them back with the button", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const page = `<form><input type="hidden" name="__VIEWSTATE" value="vs" /><input name="__VIEWSTATEGENERATOR" value="gen"><input name="ctl00$body$TBData" value="09 września 2026"></form>`;
    const zip = zipWith([{ name: "SIMC.csv", text: SIMC }]);
    const fetchImpl = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({ url: String(url), init });
      if (init?.method !== "POST") {
        return new Response(page, {
          status: 200,
          headers: { "set-cookie": "ASP.NET_SessionId=abc; path=/" },
        });
      }
      return new Response(new Uint8Array(zip), {
        status: 200,
        headers: {
          "content-type": "application/zip",
          "content-disposition":
            "attachment; filename=SIMC_Urzedowy_2026-09-09.zip",
        },
      });
    }) as unknown as typeof fetch;
    const result = await downloadTerytZip("SIMC", fetchImpl);
    expect(result.filename).toBe("SIMC_Urzedowy_2026-09-09.zip");
    expect(csvFromZip(result.zip)).toBe(SIMC);
    const post = calls[1].init!;
    const body = post.body as URLSearchParams;
    expect(body.get("__EVENTTARGET")).toBe("ctl00$body$BSIMCUrzedowyPobierz");
    expect(body.get("__VIEWSTATE")).toBe("vs");
    expect(body.get("ctl00$body$TBData")).toBe("09 września 2026");
    expect((post.headers as Record<string, string>).cookie).toBe(
      "ASP.NET_SessionId=abc",
    );
  });
});

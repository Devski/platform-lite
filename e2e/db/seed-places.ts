import { Client } from "pg";

// A handful of TERYT places for the e2e database (#87): the suggestions
// come from the `places` table now, and the test database is empty of
// them — the import is a 100 000-row download the CI runner does not make.
// Real rows from the registers of 09.09.2026, enough to show a city, a
// voivodeship, and two villages of one name told apart by their county.

const ROWS: [
  code: string,
  kind: string,
  rank: number,
  name: string,
  folded: string,
  commune: string | null,
  county: string | null,
  countyKind: string | null,
  voivodeship: string | null,
][] = [
  [
    "w12",
    "voivodeship",
    0,
    "małopolskie",
    "malopolskie",
    null,
    null,
    null,
    "małopolskie",
  ],
  [
    "w14",
    "voivodeship",
    0,
    "mazowieckie",
    "mazowieckie",
    null,
    null,
    null,
    "mazowieckie",
  ],
  [
    "p1213",
    "county",
    1,
    "oświęcimski",
    "oswiecimski",
    null,
    null,
    "county",
    "małopolskie",
  ],
  [
    "p1465",
    "county",
    1,
    "Warszawa",
    "warszawa",
    null,
    null,
    "cityCounty",
    "mazowieckie",
  ],
  [
    "g1213023",
    "commune",
    3,
    "Kęty",
    "kety",
    null,
    "oświęcimski",
    "county",
    "małopolskie",
  ],
  [
    "s0918123",
    "city",
    2,
    "Warszawa",
    "warszawa",
    "Warszawa",
    "Warszawa",
    "cityCounty",
    "mazowieckie",
  ],
  [
    "s0060612",
    "village",
    4,
    "Nowa Wieś",
    "nowa wies",
    "Kęty",
    "oświęcimski",
    "county",
    "małopolskie",
  ],
  [
    "s0060613",
    "village",
    4,
    "Nowa Wieś",
    "nowa wies",
    "Kraków",
    "Kraków",
    "cityCounty",
    "małopolskie",
  ],
  [
    "s0060665",
    "part",
    6,
    "Nowa Wieś Górna",
    "nowa wies gorna",
    "Kęty",
    "oświęcimski",
    "county",
    "małopolskie",
  ],
];

export async function seedPlaces(): Promise<void> {
  const url = process.env.DATABASE_URL_TEST?.trim();
  if (!url) throw new Error("DATABASE_URL_TEST is unset");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`seedPlaces refuses the non-loopback database ${host}`);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // Only these rows: a unit-test run against the same database leaves
    // its own places behind, and the counts below must not see them.
    await client.query("delete from places");
    for (const row of ROWS) {
      await client.query(
        `insert into places (code, kind, rank, name, name_folded, commune, county, county_kind, voivodeship, as_of)
         values ($1, $2::place_kind, $3, $4, $5, $6, $7, $8, $9, '2026-01-01')
         on conflict (code) do nothing`,
        row,
      );
    }
  } finally {
    await client.end();
  }
}

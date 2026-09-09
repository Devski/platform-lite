-- #87 / A12: every locality in Poland for the place suggestions, from the
-- GUS TERYT registers (TERC: the units; SIMC: the localities), imported by
-- scripts/import-teryt.ts. Expand-only (§8): a new type, a new table, its
-- indexes; nothing existing changes. The table is reference data the app
-- reads; the import owns its rows.

CREATE TYPE "public"."place_kind" AS ENUM('voivodeship', 'county', 'commune', 'city', 'village', 'settlement', 'part');
--> statement-breakpoint
CREATE TABLE "places" (
	"code" text PRIMARY KEY NOT NULL,
	"kind" "place_kind" NOT NULL,
	"rank" smallint NOT NULL,
	"name" text NOT NULL,
	"name_folded" text NOT NULL,
	"commune" text,
	"county" text,
	"county_kind" text,
	"voivodeship" text,
	"as_of" date NOT NULL,
	CONSTRAINT "places_name_not_blank" CHECK (length(btrim("name")) > 0),
	CONSTRAINT "places_rank_range" CHECK ("rank" BETWEEN 0 AND 9),
	CONSTRAINT "places_county_kind_known" CHECK ("county_kind" IS NULL OR "county_kind" IN ('county', 'cityCounty'))
);
--> statement-breakpoint
CREATE INDEX "places_name_folded_prefix_idx" ON "places" USING btree ("name_folded" text_pattern_ops);
--> statement-breakpoint
CREATE INDEX "places_kind_idx" ON "places" USING btree ("kind");

-- #105 (A13): an R360 archive being finished from is claimed, so the
-- orphan sweep leaves it alone for a while. Expand-only (§8, G6).

ALTER TABLE "files" ADD COLUMN "claimed_at" timestamp with time zone;
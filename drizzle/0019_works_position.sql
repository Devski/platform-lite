DROP INDEX "works_user_id_created_at_idx";--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- #66: existing works keep the order they already had. The default of 0 would
-- do that on its own, since created_at still breaks the tie — this makes the
-- column say it rather than leave every row claiming to be first.
UPDATE "works" AS w
SET "position" = ordered.rank
FROM (
  SELECT "id",
         row_number() OVER (PARTITION BY "user_id" ORDER BY "created_at", "id") - 1 AS rank
  FROM "works"
) AS ordered
WHERE w."id" = ordered."id";--> statement-breakpoint
CREATE INDEX "works_user_id_position_idx" ON "works" USING btree ("user_id","position","created_at");

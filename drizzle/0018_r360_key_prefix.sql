-- #140: where a work's frames are, recorded rather than rebuilt from the
-- environment. Expand-only: a nullable column the code before this one
-- never reads, so it is safe to apply ahead of the code that uses it —
-- which matters, because PR previews run against dev's database and never
-- migrate it (#113).
ALTER TABLE "works" ADD COLUMN "r360_key_prefix" text;--> statement-breakpoint
-- The works that already have a set: their prefix is read off one of their
-- own frame rows, which have carried their full key since #102. A set id is
-- 16 random bytes, so matching `/r360/<set>/` among the owner's files finds
-- that set's frames and no other, whatever environment wrote them. A work
-- whose frames have no rows is left null, and the reader falls back to the
-- prefix it would have rebuilt anyway.
UPDATE "works" AS w
SET "r360_key_prefix" = (
  SELECT substring(f."object_key" FROM '^(.*/r360/' || w."r360_set_id" || '/)')
  FROM "files" AS f
  WHERE f."user_id" = w."user_id"
    AND f."object_key" LIKE '%/r360/' || w."r360_set_id" || '/%'
  LIMIT 1
)
WHERE w."r360_set_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_r360_key_prefix_names_the_set" CHECK ("works"."r360_key_prefix" IS NULL OR ("works"."r360_set_id" IS NOT NULL AND right("works"."r360_key_prefix", 39) = '/r360/' || "works"."r360_set_id" || '/'));

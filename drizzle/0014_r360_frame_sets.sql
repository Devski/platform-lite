-- #102 (A13): the R360 frame set. Two frame kinds (N rows of each width
-- under the archive row), the set id and the viewer parameters on the work,
-- the variant dedup index told to leave the frames alone (by their key,
-- never by naming the values added in this very transaction, and never by
-- a cast an index predicate may not carry), and a frame keyed by its
-- object. Expand-only (§8, G6).

ALTER TYPE "public"."file_kind" ADD VALUE 'r360-1600';--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'r360-800';--> statement-breakpoint
DROP INDEX "files_variant_user_parent_kind_unique";--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "r360_set_id" text;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "r360_params" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "files_r360_frame_user_object_key_unique" ON "files" USING btree ("user_id","object_key") WHERE "files"."object_key" LIKE '%/r360/%';--> statement-breakpoint
CREATE UNIQUE INDEX "files_variant_user_parent_kind_unique" ON "files" USING btree ("user_id","parent_file_id","kind") WHERE "files"."parent_file_id" IS NOT NULL AND ("files"."object_key" IS NULL OR "files"."object_key" NOT LIKE '%/r360/%');--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_r360_set_pairing" CHECK (("works"."r360_set_id" IS NULL) = ("works"."r360_params" IS NULL));--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_r360_set_id_format" CHECK ("works"."r360_set_id" IS NULL OR "works"."r360_set_id" ~ '^[0-9a-f]{32}$');
-- #72: the profile sections decided on 08.09.2026 — headline, places, bio,
-- cover — and a profile's works with their photos and R360 archive.
--
-- Expand-only (SPEC §8): every statement adds. The two `files` indexes are
-- re-created with the same names and a predicate that reads the role from
-- parentage instead of naming `avatar-original`; for every existing row the
-- two predicates agree, and not naming a kind is what lets this run in one
-- transaction with the ADD VALUEs above it. An older image runs against
-- this schema unchanged.

ALTER TYPE "public"."file_kind" ADD VALUE 'cover-original';--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'cover-1600';--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'cover-480';--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'work-original';--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'work-1600';--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'work-480';--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'r360-zip';--> statement-breakpoint
CREATE TABLE "work_images" (
	"work_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "work_images_work_id_position_pk" PRIMARY KEY("work_id","position"),
	CONSTRAINT "work_images_position_range" CHECK ("work_images"."position" >= 0 AND "work_images"."position" <= 2)
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"investor" text,
	"developer" text,
	"r360_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "works_name_not_blank" CHECK (length(btrim("works"."name")) > 0),
	CONSTRAINT "works_name_length" CHECK (length("works"."name") <= 120),
	CONSTRAINT "works_investor_length" CHECK ("works"."investor" IS NULL OR length("works"."investor") <= 120),
	CONSTRAINT "works_developer_length" CHECK ("works"."developer" IS NULL OR length("works"."developer") <= 120)
);
--> statement-breakpoint
DROP INDEX "files_original_user_sha256_unique";--> statement-breakpoint
DROP INDEX "files_variant_user_parent_kind_unique";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "locations" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "cover_file_id" uuid;--> statement-breakpoint
ALTER TABLE "work_images" ADD CONSTRAINT "work_images_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_images" ADD CONSTRAINT "work_images_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_r360_file_id_files_id_fk" FOREIGN KEY ("r360_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_images_work_id_file_id_unique" ON "work_images" USING btree ("work_id","file_id");--> statement-breakpoint
CREATE INDEX "work_images_file_id_idx" ON "work_images" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "works_user_id_created_at_idx" ON "works" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "works_r360_file_id_idx" ON "works" USING btree ("r360_file_id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_cover_file_id_files_id_fk" FOREIGN KEY ("cover_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profiles_cover_file_id_idx" ON "profiles" USING btree ("cover_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_original_user_sha256_unique" ON "files" USING btree ("user_id","sha256","kind") WHERE "files"."parent_file_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "files_variant_user_parent_kind_unique" ON "files" USING btree ("user_id","parent_file_id","kind") WHERE "files"."parent_file_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_headline_length" CHECK ("profiles"."headline" IS NULL OR length("profiles"."headline") <= 220);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_bio_length" CHECK ("profiles"."bio" IS NULL OR length("profiles"."bio") <= 1500);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_locations_count" CHECK (cardinality("profiles"."locations") <= 8);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_locations_no_null" CHECK (array_position("profiles"."locations", NULL) IS NULL);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_locations_total_length" CHECK (length(array_to_string("profiles"."locations", '')) <= 640);
-- #99: a work photo may carry a second channel — the same view the other
-- way (before/after, day/night, render/photograph). Expand-only (§8): one
-- nullable column on work_images, its foreign key (restrict, as file_id),
-- an index for the "is this file still used" question, and a CHECK that the
-- channel is another picture.

ALTER TABLE "work_images" ADD COLUMN "secondary_file_id" uuid;--> statement-breakpoint
ALTER TABLE "work_images" ADD CONSTRAINT "work_images_secondary_file_id_files_id_fk" FOREIGN KEY ("secondary_file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_images_secondary_file_id_idx" ON "work_images" USING btree ("secondary_file_id");--> statement-breakpoint
ALTER TABLE "work_images" ADD CONSTRAINT "work_images_secondary_differs" CHECK ("work_images"."secondary_file_id" IS NULL OR "work_images"."secondary_file_id" <> "work_images"."file_id");
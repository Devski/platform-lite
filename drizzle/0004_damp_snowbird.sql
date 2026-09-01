DROP INDEX "files_user_sha256_kind_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "files_original_user_sha256_unique" ON "files" USING btree ("user_id","sha256","kind") WHERE "files"."kind" = 'avatar-original';--> statement-breakpoint
CREATE UNIQUE INDEX "files_variant_user_parent_kind_unique" ON "files" USING btree ("user_id","parent_file_id","kind") WHERE "files"."kind" <> 'avatar-original';--> statement-breakpoint
CREATE INDEX "files_parent_file_id_idx" ON "files" USING btree ("parent_file_id");
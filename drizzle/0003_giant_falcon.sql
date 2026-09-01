ALTER TABLE "files" ADD COLUMN "parent_file_id" uuid;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "ext" text NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_parent_file_id_files_id_fk" FOREIGN KEY ("parent_file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
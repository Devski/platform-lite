CREATE TABLE "pending_uploads" (
	"staging_key" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"size_bytes" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_uploads" ADD CONSTRAINT "pending_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_uploads_user_id_size_bytes_idx" ON "pending_uploads" USING btree ("user_id","size_bytes");--> statement-breakpoint
CREATE INDEX "pending_uploads_user_id_expires_at_idx" ON "pending_uploads" USING btree ("user_id","expires_at");
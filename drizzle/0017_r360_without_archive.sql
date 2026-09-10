-- #120: the R360 zip is never uploaded any more. It is read on the owner's
-- machine and stays there, so nothing on the server owns an archive.
--
-- Three things have to happen in this order:
--   1. the frames let go of the archive row they hung from (they were its
--      variants, so deleting it would have cascaded over them);
--   2. the archive rows go, since no column can name them any longer — the
--      objects behind them are removed by scripts/drop-r360-archives.ts,
--      which is run against an environment BEFORE this migration reaches it
--      (G2: objects are freed through code, never left to rot);
--   3. the pointer, its index and its foreign key go with the claim column
--      that only #105 ever read.
--
-- The unique index on originals is rebuilt in the same breath: a frame has
-- no parent now, so it would fall into that index, where two frames of one
-- orbit that encode to identical bytes collide on (user, sha256, kind) and
-- the save fails. Frames are told apart by their key, as they are in the
-- variant index beside it.

UPDATE "files" SET "parent_file_id" = NULL WHERE "object_key" LIKE '%/r360/%';--> statement-breakpoint
DELETE FROM "files" WHERE "kind" = 'r360-zip';--> statement-breakpoint
ALTER TABLE "works" DROP CONSTRAINT "works_r360_file_id_files_id_fk";
--> statement-breakpoint
DROP INDEX "works_r360_file_id_idx";--> statement-breakpoint
DROP INDEX "files_original_user_sha256_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "files_original_user_sha256_unique" ON "files" USING btree ("user_id","sha256","kind") WHERE "files"."parent_file_id" IS NULL AND ("files"."object_key" IS NULL OR "files"."object_key" NOT LIKE '%/r360/%');--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "claimed_at";--> statement-breakpoint
ALTER TABLE "works" DROP COLUMN "r360_file_id";
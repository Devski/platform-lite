-- #72 step 4: freeing a photo set asks, per key, whether another row still
-- names the object; the question is answered by object_key, which had no index.

CREATE INDEX "files_object_key_idx" ON "files" USING btree ("object_key");
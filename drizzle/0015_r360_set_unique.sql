-- #102 review: a frame set belongs to exactly one work. The code refuses
-- a second save of one set; the database says it too. Expand-only (§8, G6).

CREATE UNIQUE INDEX "works_r360_set_id_unique" ON "works" USING btree ("r360_set_id");
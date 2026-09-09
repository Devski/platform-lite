import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { defaultR360Params } from "@/lib/r360/frame-set-shared";

// Works for an e2e account, written straight into the test database: a
// browser-driven add needs a bucket (the photo goes through S3), which CI
// has not, and the tests of the list itself (#86: the form takes the
// card's place) need works that exist. The files rows are placeholders —
// no object behind them, the card's image 404s and that is fine here.

export interface SeededWork {
  id: string;
  name: string;
}

/**
 * A name, a name with a second channel on its photo (#99), or a name with
 * an R360 set of N frames and no photo (#103) — the archive row and the
 * set id are placeholders, the frames have no objects behind them.
 */
export type SeedWork =
  | string
  | { name: string; secondChannel: true }
  | { name: string; r360: { frameCount: number; startFrame?: number } };

export async function seedWorks(
  handle: string,
  works: SeedWork[],
): Promise<SeededWork[]> {
  const url = process.env.DATABASE_URL_TEST?.trim();
  if (!url) throw new Error("DATABASE_URL_TEST is unset");
  // Rows the app itself would never write go only where an e2e run has a
  // legitimate target: loopback (local Postgres, the tunnel, CI's service).
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`seedWorks refuses the non-loopback database ${host}`);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const owner = await client.query<{ user_id: string }>(
      "select user_id from profiles where handle = $1",
      [handle],
    );
    const userId = owner.rows[0]?.user_id;
    if (!userId) throw new Error(`no profile for handle ${handle}`);
    const insertId = async (sql: string, values: unknown[]) =>
      (await client.query<{ id: string }>(sql, values)).rows[0].id;
    const placeholder = () =>
      insertId(
        `insert into files (user_id, sha256, size_bytes, kind, ext)
         values ($1, $2, 1, 'work-original', 'png') returning id`,
        [userId, randomBytes(32).toString("hex")],
      );
    const photoWork = async (name: string, secondChannel: boolean) => {
      const fileId = await placeholder();
      const secondaryId = secondChannel ? await placeholder() : null;
      const workId = await insertId(
        `insert into works (user_id, name) values ($1, $2) returning id`,
        [userId, name],
      );
      await client.query(
        `insert into work_images (work_id, file_id, secondary_file_id, position)
         values ($1, $2, $3, 0)`,
        [workId, fileId, secondaryId],
      );
      return workId;
    };
    const r360Work = async (
      name: string,
      r360: { frameCount: number; startFrame?: number },
    ) => {
      const archiveId = await insertId(
        `insert into files (user_id, sha256, size_bytes, kind, ext)
         values ($1, $2, 1, 'r360-zip', 'zip') returning id`,
        [userId, `md5-${randomBytes(16).toString("hex")}`],
      );
      const params = {
        ...defaultR360Params(r360.frameCount),
        startFrame: r360.startFrame ?? 1,
      };
      return insertId(
        `insert into works (user_id, name, r360_file_id, r360_set_id, r360_params)
         values ($1, $2, $3, $4, $5) returning id`,
        [userId, name, archiveId, randomBytes(16).toString("hex"), params],
      );
    };
    const seeded: SeededWork[] = [];
    for (const entry of works) {
      const name = typeof entry === "string" ? entry : entry.name;
      const id =
        typeof entry !== "string" && "r360" in entry
          ? await r360Work(name, entry.r360)
          : await photoWork(name, typeof entry !== "string");
      seeded.push({ id, name });
    }
    return seeded;
  } finally {
    await client.end();
  }
}

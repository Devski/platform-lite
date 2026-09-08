import { randomBytes } from "node:crypto";
import { Client } from "pg";

// Works for an e2e account, written straight into the test database: a
// browser-driven add needs a bucket (the photo goes through S3), which CI
// has not, and the tests of the list itself (#86: the form takes the
// card's place) need works that exist. The files rows are placeholders —
// no object behind them, the card's image 404s and that is fine here.

export interface SeededWork {
  id: string;
  name: string;
}

export async function seedWorks(
  handle: string,
  names: string[],
): Promise<SeededWork[]> {
  const url = process.env.DATABASE_URL_TEST?.trim();
  if (!url) throw new Error("DATABASE_URL_TEST is unset");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const owner = await client.query<{ user_id: string }>(
      "select user_id from profiles where handle = $1",
      [handle],
    );
    const userId = owner.rows[0]?.user_id;
    if (!userId) throw new Error(`no profile for handle ${handle}`);
    const seeded: SeededWork[] = [];
    for (const name of names) {
      const file = await client.query<{ id: string }>(
        `insert into files (user_id, sha256, size_bytes, kind, ext)
         values ($1, $2, 1, 'work-original', 'png') returning id`,
        [userId, randomBytes(32).toString("hex")],
      );
      const work = await client.query<{ id: string }>(
        `insert into works (user_id, name) values ($1, $2) returning id`,
        [userId, name],
      );
      await client.query(
        `insert into work_images (work_id, file_id, position) values ($1, $2, 0)`,
        [work.rows[0].id, file.rows[0].id],
      );
      seeded.push({ id: work.rows[0].id, name });
    }
    return seeded;
  } finally {
    await client.end();
  }
}

import { users } from "@/db/schema";
import { REGISTRATION_NAME } from "@/lib/account";
import type { Database } from "@/db/client";

// The one way a test creates an account (#40).
//
// Fixtures used to insert their own idea of a new user, hard-coding a name the
// product had stopped writing. The tests then described a world that no longer
// existed — and stayed green while two features broke on dev, because in tests
// the field was never blank and in reality it always was.
//
// Going through the real sign-up endpoint instead is not the answer: scrypt is
// deliberately slow (about three seconds per account, measured), fixtures run
// before every test, and a registration bug would then fail fifty tests that
// are not about registration. So the shortcut stays — it just stops being a
// copy nobody owns. `auth.test.ts` pins this against a real sign-up.

export async function insertTestAccount(
  db: Database,
  options: {
    email: string;
    /** Registration creates an unverified account; most fixtures skip ahead. */
    verified?: boolean;
  },
): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({
      name: REGISTRATION_NAME,
      email: options.email,
      emailVerified: options.verified ?? false,
    })
    .returning({ id: users.id });
  return row.id;
}

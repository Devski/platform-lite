# Copying the database, and restoring it

What is copied, where it lands, and exactly what to type when the copy is the
only thing left. Written for #168, which found that nothing copied dev's
database anywhere at all: it lives in one Docker volume on one €7 instance, and
G10's restore procedure had nothing to restore from.

## Why this matters more than the rows

An object's key in the bucket is a content hash kept in the row that names it
(G2, and `files.object_key` since #49). The database is therefore not merely the
data — it is **the only map to the bucket**. Lose it and the objects are still
there, still paid for, and unreachable: 2,208 file rows on dev today, most of
them R360 frames. This is the same reasoning that makes `files.user_id`
`ON DELETE RESTRICT` (#34).

## What runs

|          |                                                                                            |
| -------- | ------------------------------------------------------------------------------------------ |
| What     | every `platform_*` database except the test ones, `pg_dump --create --clean --if-exists`   |
| Where    | `s3://platform-dev/<prefix>backups/pg/<weekday>.sql.gz` (`mon`…`sun`)                      |
| When     | daily at 03:17 UTC, `Persistent=true` — an instance that was down copies at the next boot  |
| How many | seven, one per weekday slot, each overwritten a week later                                 |
| Size     | 1.8 MB compressed, about 3 seconds end to end (12.09.2026)                                 |
| Script   | `deploy/backup-db.sh`, shipped by the deploy; units installed by `deploy/remote-deploy.sh` |

Retention is the **shape of the key**, not a rule anyone maintains: seven slots,
overwritten. Nothing lists, nothing deletes, and no second lifecycle rule can
collide with the one the bootstrap wrote for staged uploads.

Each run reads its own upload back and compares it byte for byte before
recording success. A copy nobody has read back is not a copy — it is a request
that returned 200.

### What is NOT copied

- **The bucket objects.** If the bucket goes, the restored rows are a map to
  nothing. Accepted for dev; production decides in #24.
- **Roles.** Everything here connects as the bootstrap superuser, which every
  cluster is born with. The script _checks_ this on every run and refuses to
  make a copy the day it stops being true, rather than leaving it as an
  assumption someone breaks in a year.
- **The test databases** (`*_test_*`) — a test run recreates them from nothing.

### Who can read a copy

Anyone holding the bucket's S3 key: the objects carry no public-read ACL, and
OVHcloud implements no bucket policy, so private is the default here — but the
key that writes the copy is the same key the application already uses for every
user file. **A dump carries e-mail addresses and password hashes.** For dev that
is accepted and written down here; production (#24) should not reuse the
application's key for its copies.

## Restoring

The dump begins with `DROP DATABASE IF EXISTS`. Read that sentence twice before
pointing it at a live cluster.

Fetch the copy (from the instance, where the credentials already are):

```bash
while IFS= read -r l; do case "$l" in S3_*=*) export "${l%%=*}=${l#*=}";; esac; done </opt/platform-lite/.env
curl --fail-with-body -sS --aws-sigv4 "aws:amz:$S3_REGION:s3" --user "$S3_KEY:$S3_SECRET" \
  "$S3_ENDPOINT/$S3_BUCKET/${S3_PREFIX}backups/pg/LATEST"
curl --fail-with-body -sS --aws-sigv4 "aws:amz:$S3_REGION:s3" --user "$S3_KEY:$S3_SECRET" \
  "$S3_ENDPOINT/$S3_BUCKET/${S3_PREFIX}backups/pg/sat.sql.gz" -o /var/tmp/dump.sql.gz
```

`LATEST` names the newest slot, its timestamp and its size. Slots are named for
the day the copy was made, so the age of a copy is in its name.

**Into a throwaway cluster** (the drill, and how to read a copy without touching
anything that is running):

```bash
docker run -d --name pg-restore-drill -e POSTGRES_PASSWORD=drill-only postgres:17
until docker exec pg-restore-drill pg_isready -U postgres; do sleep 2; done
gzip -dc /var/tmp/dump.sql.gz | docker exec -i pg-restore-drill psql -U postgres -v ON_ERROR_STOP=1
# ... look at it, compare counts, take what you need ...
docker rm -f pg-restore-drill
```

**Into the live cluster** — this replaces the database:

```bash
docker compose --project-directory /opt/platform-lite stop app   # nothing writing
gzip -dc /var/tmp/dump.sql.gz | docker exec -i postgres psql -U postgres -v ON_ERROR_STOP=1
docker compose --project-directory /opt/platform-lite start app
```

`ON_ERROR_STOP=1` is not decoration: it is what makes "restore ok" mean
something. A restore that prints errors and keeps going has told you nothing.

## Checking that it still works

```bash
systemctl list-timers platform-backup.timer          # when it next runs, when it last did
journalctl -u platform-backup.service -n 20          # what the last run said
cat /var/lib/platform-backup/last-success            # timestamp, key, bytes
```

Every deployment prints a warning when that file is missing or more than two
days old. That is a stopgap and it is written down as one: it depends on a human
reading a deploy log, which is exactly the gap #167 exists to close.

## The drill — 12.09.2026

Performed on the dev instance, against the copy in the bucket, not against a
local file:

1. Fetched `backups/pg/sat.sql.gz` (1,813,866 bytes) and `LATEST` from the bucket.
2. Restored into a throwaway `postgres:17` container with `ON_ERROR_STOP=1` —
   **no errors**.
3. Compared six tables between the live cluster and the restored one:
   `files` 2208, `pending_uploads` 24, `profiles` 30, `users` 30, `works` 18,
   `handle_redirects` 5 — identical.
4. Took `object_key` from the three newest `files` rows **of the restored
   database** and asked the bucket for them: `HEAD 200` on all three. The map
   survived, which is the property that actually matters.
5. Removed the drill container.

**What the drill caught.** The first version of this dumped the whole cluster
with `pg_dumpall`. It restored into an empty cluster and died on the first
statement — `role "postgres" already exists` — because every cluster is born
with that role. A copy that had never been restored would have looked perfect
for months: the right size, uploaded on schedule, complete, and unusable on the
one day it was needed. It is now `pg_dump --create --clean --if-exists` per
database, which replays cleanly into an empty cluster and over an existing one.

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
| Where    | `s3://platform-dev/backups/<environment prefix>pg/<weekday>.sql.gz` (`mon`…`sun`)          |
| When     | daily at 03:17 UTC, `Persistent=true` — an instance that was down copies at the next boot  |
| How many | seven, one per weekday slot, each overwritten a week later                                 |
| Size     | 1.8 MB compressed, about 3 seconds end to end (12.09.2026)                                 |
| Script   | `deploy/backup-db.sh`, shipped by the deploy; units installed by `deploy/remote-deploy.sh` |

Retention is the **shape of the key**, not a rule anyone maintains: seven slots,
overwritten. Nothing lists, nothing deletes, and no second lifecycle rule can
collide with the one the bootstrap wrote for staged uploads.

`backups/` sits at the root of the bucket and the environment prefix goes
_inside_ it — `backups/devski/pg/…`, not `devski/backups/…`. Everything that
sweeps this bucket lists `<prefix>…` and removes what no database row names,
which is every copy here by definition. The one such job already written down
(the closing note in `deploy/preview-down.sh`, and #34) has exactly that shape.
Being outside the swept namespace is the only version of this that survives
someone writing that job without thinking about backups.

Each run reads its own upload back and compares it byte for byte before
recording success. A copy nobody has read back is not a copy — it is a request
that returned 200.

### What is NOT copied

- **The bucket objects.** If the bucket goes, the restored rows are a map to
  nothing. Accepted for dev; production decides in #24.
- **Roles.** Everything here connects as the bootstrap superuser, which every
  cluster is born with. The script _checks_ that on every run — and the day it
  stops being true it still makes the copy, then fails loudly naming the roles
  it did not carry. A copy missing roles is two minutes of `CREATE ROLE` from
  whole; no copy at all is the thing this file exists to prevent. When that
  happens, the copy must grow: `pg_dumpall --roles-only`, with the line creating
  the bootstrap superuser removed, prepended to the dump.
- **The test databases** (`*_test_*`) — a test run recreates them from nothing.

### Who can read a copy, and what it is worth

The object carries no public-read ACL, and OVHcloud implements no bucket policy,
so private is the default here. The copy's confidentiality is therefore exactly
the secrecy of the bucket's S3 key.

That key is the application's own, and it is in the environment of the
internet-facing process. **This is a deliberate trade for dev and it should not
be repeated in production** (#24): before this, the key bought an attacker the
user photos; now it also buys every row of every database — e-mail addresses and
profile data for every account, scrypt password hashes (salted per user, so not
a fast crack), session tokens, and the pending verification values that are
stored in the clear for everything except password resets. The same key can also
delete: seven fixed keys, no versioning, so a copy does not survive the
compromise it exists to survive.

Production wants a second, write-only credential used by nothing but the timer,
ideally against a different bucket.

## Restoring

The dump begins with `DROP DATABASE IF EXISTS`. Read that sentence twice before
pointing it at a live cluster.

Fetch the copy (from the instance, where the credentials already are). Two
things in here are not ceremony: `umask` first, or curl writes a world-readable
dump into a directory that survives reboots — and the credentials go in a file,
because `/proc/<pid>/cmdline` is world-readable and `--user key:secret` would
show the secret to every account on the host for the length of the transfer.

```bash
while IFS= read -r l || [ -n "$l" ]; do case "$l" in S3_*=*) export "${l%%=*}=${l#*=}";; esac; done </opt/platform-lite/.env
umask 077
printf 'user = "%s:%s"\n' "$S3_KEY" "$S3_SECRET" >/var/tmp/s3.curlrc
s3() { curl --config /var/tmp/s3.curlrc --aws-sigv4 "aws:amz:$S3_REGION:s3" --fail-with-body -sS "$@"; }

s3 "$S3_ENDPOINT/$S3_BUCKET/backups/${S3_PREFIX}pg/LATEST"
s3 "$S3_ENDPOINT/$S3_BUCKET/backups/${S3_PREFIX}pg/sat.sql.gz" -o /var/tmp/dump.sql.gz
```

`LATEST` names the newest slot, its timestamp and its size. Slots are named for
the day the copy was made, so the age of a copy is in its name.

**Into a throwaway cluster** (the drill, and how to read a copy without touching
anything that is running). `rm -fv`, with the `v`: the image declares a volume,
so without it the whole restored database stays on the disk as an anonymous
volume nobody will ever look at.

```bash
docker run -d --name pg-restore-drill -e POSTGRES_PASSWORD=drill-only postgres:17
until docker exec pg-restore-drill pg_isready -U postgres; do sleep 2; done
gzip -dc /var/tmp/dump.sql.gz | docker exec -i pg-restore-drill psql -U postgres -v ON_ERROR_STOP=1
# ... look at it, compare counts, take what you need ...
docker rm -fv pg-restore-drill
```

**Into the live cluster** — this replaces the database. Take a copy of what you
are about to destroy first; restoring a slot up to seven days old throws away
everything since, and in another seven days that slot is overwritten too, so
even the evidence goes.

```bash
sudo systemctl start platform-backup.service   # step 0: today's state, in the bucket
docker compose --project-directory /opt/platform-lite stop app
PG=            # fill this in with: postgres
gzip -dc /var/tmp/dump.sql.gz | docker exec -i "$PG" psql -U postgres -v ON_ERROR_STOP=1
docker compose --project-directory /opt/platform-lite start app
```

`PG` is left empty on purpose. This block is two lines away from a harmless one
and will be read at three in the morning; filling in the container name is the
deliberate act that separates them.

`ON_ERROR_STOP=1` is not decoration: it is what makes "restore ok" mean
something. A restore that prints errors and keeps going has told you nothing.

**When you are done**, in either case:

```bash
rm -f /var/tmp/dump.sql.gz /var/tmp/s3.curlrc
```

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

1. Fetched the newest slot (1,813,866 bytes) and `LATEST` from the bucket.
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

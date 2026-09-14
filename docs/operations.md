# Operations — knowing what an environment is doing

What this system watches, how often, where each finding appears, who it
reaches, and what it means someone should do. Written for #167, on 12.09.2026,
after a report that had been warning into a container's log for two days
reached a person exactly once — because someone went looking.

## Is everything fine right now?

One place, and nothing else to open: **the last daily report in the inbox
named by `OPS_EMAIL`.** One arrives every morning (05:00 UTC) whether or not
anything is wrong. Its subject says which: `[dev] daily: nothing to do`,
`… 2 to look at this week`, or `… 1 to act on`.

**No daily report by 08:00 Warsaw time is itself the signal**: the instance,
its timer or the mail path is broken. Open `https://dev.architektow3d.pl/` —
if it answers, the instance is up and the report is what failed
(`systemctl status platform-ops.service` over SSH); if it does not, the
instance is down — the OVH console.

## The one watcher

| Where it runs                                                | How often  | What it can see                                                                      | What it cannot              |
| ------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------ | --------------------------- |
| `deploy/ops-check.sh`, on the instance, `platform-ops.timer` | every hour | the disk, the containers, the nightly copy, the application's log, the mail provider | its own instance being down |

A box cannot report its own death. Until 14.09.2026 a second watcher did, from
outside: `.github/workflows/watch.yml` asked every thirty minutes whether the
site answered and opened an `outage` issue when it did not. It was removed with
that day's CI changes (SPEC §8) — on dev, the missing morning report says the
same thing a few hours later, and nobody depends on dev being up. The outside
check comes back at the production launch (#24) as an external uptime
service, not a workflow.

## The three tiers

At most three, because a channel that says everything is a channel nobody
reads — which is the failure this document exists to prevent, one level up.

- **ACT NOW** — mailed within the hour it starts, again if still true a day
  later, and once more, per condition, when it stops (`[dev] resolved: …`). A
  number changing inside the same problem (disk 91% → 92%) does not send
  another; a NEW problem while one is standing is named in the subject.
  Conditions one bad look can produce on one core — the site not answering, a
  container missing, Docker not answering — need two hourly looks in a row: the
  first appears under THIS WEEK as "seen once".
- **THIS WEEK** — in the daily report.
- **RECORD** — in the daily report, so a figure has a history to compare with.

## What each signal means, and what to do

| Signal                                              | Tier      | What to do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disk at 90% or more                                 | ACT NOW   | Full, PostgreSQL stops writing — dev and every preview go down together. Since #119 every deployment clears application images beyond the last three that came up healthy, so first look at what else grew: `sudo docker system df`, `sudo du -sh /var/lib/containerd /var/lib/docker /var/log`. **Never remove an image listed in `/opt/platform-lite/deployed-images`**: those are the rollback targets, and the instance holds no registry credential to pull them back (`docs/deployment.md`). |
| Disk at 80–89%                                      | this week | The same, with time to plan it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| A container is missing, stopped or unhealthy        | ACT NOW   | `docker ps -a`; for the app, `journalctl CONTAINER_NAME=platform-lite-app-1 -n 100`. Rolling back is redeploying an older tag (SPEC §8).                                                                                                                                                                                                                                                                                                                                                           |
| The site does not answer from the instance itself   | ACT NOW   | The proxy or the app — the container lines in the same report say which.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| The newest copy of the databases is over 36 h old   | ACT NOW   | The nightly copy has stopped (#168). `systemctl status platform-backup.service`, `journalctl -u platform-backup.service -n 50`. A refusal to shrink is explained in `deploy/backup-db.sh`.                                                                                                                                                                                                                                                                                                         |
| No copy has ever succeeded                          | ACT NOW   | A new instance where the timer was never installed, or it never once worked: `docs/backup-and-restore.md`.                                                                                                                                                                                                                                                                                                                                                                                         |
| Preview databases with no container                 | this week | Copies of dev's accounts, left by a preview removed some other way than closing its pull request. The next preview sweeps them; by hand: `docs/dev-environment.md`.                                                                                                                                                                                                                                                                                                                                |
| The R360 collector found frame sets no record names | this week | By design it deletes nothing it cannot account for, and waits for a person (#156). The list is in the log: `journalctl CONTAINER_NAME=platform-lite-app-1 \| grep collector`. Decide per set; nothing is lost by waiting a week.                                                                                                                                                                                                                                                                   |
| The R360 collector failed                           | this week | The same log. A sweep that stops reporting is worse than one that fails loudly — this is the loud version.                                                                                                                                                                                                                                                                                                                                                                                         |
| Database deadlines hit                              | this week | #172. Which bound and which path are in the log (`grep '\[db\]'`); one a day is noise, a pattern is a query or a lock to look at.                                                                                                                                                                                                                                                                                                                                                                  |
| Unhandled server errors                             | this week | The log for the last day — read it on the instance, and see "Logs" below before copying a line anywhere.                                                                                                                                                                                                                                                                                                                                                                                           |
| A quarter or more of mail failed (4+ sent)          | ACT NOW   | The sending domain's reputation or the provider — people are not receiving verification messages. Scaleway console → Transactional Email; SPF/DKIM/DMARC per G8.                                                                                                                                                                                                                                                                                                                                   |
| Some mail failed                                    | this week | A bounce or a rejection — usually one bad address.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| The provider blocks more addresses than yesterday   | this week | A hard bounce or a complaint. The addresses are in the Scaleway console, deliberately not in the report.                                                                                                                                                                                                                                                                                                                                                                                           |

## What the report never carries

No e-mail address, handle, name, or line of any log — only counts and the
instance's own figures. The mailbox it goes to may sit outside the EU, and
§7 keeps personal data out of that path. Everything a count points at is one
command away on the instance, where it already is.

## Setting it up

On the instance, in `/opt/platform-lite/.env`:

```
OPS_EMAIL=<the address that should receive the reports>
```

Nothing else: it sends through the transactional mail provider the application
already uses (#22), with the same key. Until `OPS_EMAIL` is set, every report
reaches the journal and nobody else — and says so in its last line.

The timer, the journal's cap and the unit files are installed by every
deployment (`deploy/remote-deploy.sh`). To run a check now:

```
sudo systemctl start platform-ops.service
journalctl -u platform-ops.service -n 40 --no-pager
```

## Logs

The application's and the proxy's logs go to the host's journal
(`deploy/compose.yaml`), not to a file inside the container's directory.
That file is deleted with the container, which is every deploy — so until
#167 the log of the hour before a bad deploy was gone by the time anyone
looked for it. The journal is capped at 300 MB and two weeks
(`/etc/systemd/journald.conf.d/platform-lite.conf`; one file a day, so the two
weeks are real), the lines are kept out of `/var/log/syslog`
(`/etc/rsyslog.d/10-platform-lite.conf`), and every entry carries the
container's name, which compose keeps across deploys:

```
journalctl CONTAINER_NAME=platform-lite-app-1 --since "2 hours ago"
```

Preview containers keep Docker's file log, capped at three 10 MB files: they
are throwaway, and their log goes with them on purpose.

**Never paste a log line into an issue, a pull request or a chat.** A failed
database query is logged with its parameters, and those can be an e-mail
address or a live session token; this repository is public. Describe what the
line says, or redact it first. That the lines carry parameters at all is its
own task (#186), and until it is done this rule is the whole defence.

## What is not covered yet

Said here so that silence about them is not read as "checked":

- **PostgreSQL's own log** stays in Docker's file log. The container was
  started by cloud-init with `docker run` (#2), and moving it means recreating
  the database container — not a change to make in passing.
- **Whether dev answers from outside.** Nothing asks since 14.09.2026; the
  missing morning report is the signal, hours later rather than minutes.
- **Production** does not exist yet (#24). The instance check takes it by an
  `OPS_EMAIL` on its instance; the outside check arrives with it as an
  external uptime service; its managed database's own alerts are OVH's and
  belong in #24.
- **Log lines carry query parameters.** Drizzle wraps a failed query with
  its parameters and Better Auth logs that error whole, so an address or a
  session token can reach the journal. Two weeks of retention bounds it; it
  does not remove it, and the journal cannot forget one account (#34). Redacting
  at the source is #186.
- **Shipping logs somewhere else** was considered and not done: it means a new
  provider, a recurring cost, and log lines that can carry personal data
  leaving the EU (§7). The instance speaking for itself covers the need today.

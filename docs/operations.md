# Operations — knowing what an environment is doing

What this system watches, how often, where each finding appears, who it
reaches, and what it means someone should do. Written for #167, on 12.09.2026,
after a report that had been warning into a container's log for two days
reached a person exactly once — because someone went looking.

## Is everything fine right now?

Two places, and nothing else to open:

1. **The last daily report in the inbox named by `OPS_EMAIL`.** One arrives
   every morning (05:00 UTC) whether or not anything is wrong. Its subject
   says which: `[dev] daily: nothing to do`, `… 2 to look at this week`, or
   `… 1 to act on`.
2. **Issues labelled [`outage`](https://github.com/Devski/platform-lite/issues?q=label%3Aoutage)
   on GitHub.** An open one means the site is not answering from outside;
   none means it is.

**No daily report by 08:00 Warsaw time is itself the signal**: the instance,
its timer or the mail path is broken. Look at the `outage` label first — if the
site answers from outside, the instance is up and the report is what failed
(`systemctl status platform-ops.service` over SSH).

## The two watchers

|                               | Where it runs                         | How often        | What it can see                                                                      | What it cannot              |
| ----------------------------- | ------------------------------------- | ---------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| `deploy/ops-check.sh`         | on the instance, `platform-ops.timer` | every hour       | the disk, the containers, the nightly copy, the application's log, the mail provider | its own instance being down |
| `.github/workflows/watch.yml` | on GitHub's machines                  | every 30 minutes | whether the site answers from the internet                                           | anything inside             |

They are deliberately two. A box cannot report its own death, and the thing
outside cannot see the disk.

## The three tiers

At most three, because a channel that says everything is a channel nobody
reads — which is the failure this document exists to prevent, one level up.

- **ACT NOW** — mailed within the hour it starts, again if still true a day
  later, and once more when it stops (`[dev] resolved: …`). A number changing
  inside the same problem (disk 91% → 92%) does not send another.
- **THIS WEEK** — in the daily report.
- **RECORD** — in the daily report, so a figure has a history to compare with.

## What each signal means, and what to do

| Signal                                                 | Tier      | What to do                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disk at 90% or more                                    | ACT NOW   | Full, PostgreSQL stops writing — dev and every preview go down together. The usual cause is application images: one per commit, nothing prunes (#119). `docker image ls ghcr.io/devski/platform-lite` and remove the oldest ones no container uses; keep the last few for rollback. |
| Disk at 80–89%                                         | this week | The same, with time to plan it.                                                                                                                                                                                                                                                     |
| A container is missing, stopped or unhealthy           | ACT NOW   | `docker ps -a`; for the app, `journalctl CONTAINER_NAME=platform-lite-app-1 -n 100`. Rolling back is redeploying an older tag (SPEC §8).                                                                                                                                            |
| The site does not answer from the instance itself      | ACT NOW   | The proxy or the app — the container lines in the same report say which.                                                                                                                                                                                                            |
| The site does not answer from outside (`outage` issue) | ACT NOW   | If the report from the instance still arrives, it is the network, DNS or the certificate; if it has also stopped, the instance is down — the OVH console.                                                                                                                           |
| The newest copy of the databases is over 36 h old      | ACT NOW   | The nightly copy has stopped (#168). `systemctl status platform-backup.service`, `journalctl -u platform-backup.service -n 50`. A refusal to shrink is explained in `deploy/backup-db.sh`.                                                                                          |
| No copy has ever succeeded                             | ACT NOW   | A new instance where the timer was never installed, or it never once worked: `docs/backup-and-restore.md`.                                                                                                                                                                          |
| Preview databases with no container                    | this week | Copies of dev's accounts, left by a preview removed some other way than closing its pull request. The next preview sweeps them; by hand: `docs/dev-environment.md`.                                                                                                                 |
| The R360 collector found frame sets no record names    | this week | By design it deletes nothing it cannot account for, and waits for a person (#156). The list is in the log: `journalctl CONTAINER_NAME=platform-lite-app-1 \| grep collector`. Decide per set; nothing is lost by waiting a week.                                                    |
| The R360 collector failed                              | this week | The same log. A sweep that stops reporting is worse than one that fails loudly — this is the loud version.                                                                                                                                                                          |
| Database deadlines hit                                 | this week | #172. Which bound and which path are in the log (`grep '\[db\]'`); one a day is noise, a pattern is a query or a lock to look at.                                                                                                                                                   |
| Unhandled server errors                                | this week | The log for the last day.                                                                                                                                                                                                                                                           |
| A quarter or more of mail failed (4+ sent)             | ACT NOW   | The sending domain's reputation or the provider — people are not receiving verification messages. Scaleway console → Transactional Email; SPF/DKIM/DMARC per G8.                                                                                                                    |
| Some mail failed                                       | this week | A bounce or a rejection — usually one bad address.                                                                                                                                                                                                                                  |
| The provider blocks more addresses than yesterday      | this week | A hard bounce or a complaint. The addresses are in the Scaleway console, deliberately not in the report.                                                                                                                                                                            |

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

To try the outside alarm without breaking dev, run the `Watch` workflow by
hand with an address that cannot answer (`https://down.invalid/`): it opens an
`outage` issue. The next scheduled run against dev closes it again.

## Logs

The application's and the proxy's logs go to the host's journal
(`deploy/compose.yaml`), not to a file inside the container's directory.
That file is deleted with the container, which is every deploy — so until
#167 the log of the hour before a bad deploy was gone by the time anyone
looked for it. The journal is capped at 300 MB and thirty days
(`/etc/systemd/journald.conf.d/platform-lite.conf`), and every entry carries
the container's name, which compose keeps across deploys:

```
journalctl CONTAINER_NAME=platform-lite-app-1 --since "2 hours ago"
```

Preview containers keep Docker's file log, capped at three 10 MB files: they
are throwaway, and their log goes with them on purpose.

## What is not covered yet

Said here so that silence about them is not read as "checked":

- **PostgreSQL's own log** stays in Docker's file log. The container was
  started by cloud-init with `docker run` (#2), and moving it means recreating
  the database container — not a change to make in passing.
- **Production** does not exist yet (#24). Both watchers take it by adding an
  address and an `OPS_EMAIL` on its instance; its managed database's own
  alerts are OVH's and belong in #24.
- **The watcher watching itself.** GitHub delays scheduled runs under load and
  disables them in a repository with no activity for sixty days. The daily
  report cannot see whether `watch.yml` ran. If the repository goes quiet for
  two months, re-enable the workflow in the Actions tab.
- **Shipping logs somewhere else** was considered and not done: it means a new
  provider, a recurring cost, and log lines that can carry personal data
  leaving the EU (§7). The instance speaking for itself covers the need today.

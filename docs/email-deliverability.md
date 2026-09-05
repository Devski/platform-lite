# E-mail deliverability

SPEC §10 accepts "Scaleway TEM deliverability to Polish mailboxes unverified" as
a risk. This is the measurement that retires it, and the record of how far the
measurement actually goes.

## What was measured

**5 September 2026**, sending domain `dev.architektow3d.pl`, sender
`Architektów 3d <kontakt@dev.architektow3d.pl>`, reply address
`kontakt@architektow3d.pl`. Every DNS record verified by the provider: SPF,
DKIM (selector is the project id), DMARC, and the MX pointing at the provider's
blackhole. Messages carry the real Polish templates from `messages/pl.json`,
not stand-in text — the body is part of what a spam filter judges.

| Message | Accepted | Inbox |
| --- | --- | --- |
| Verification (`accountVerification`) | 250 | yes |
| New verification link (`accountReverification`) | 250 | yes |
| Password reset (`passwordReset`) | 250 | yes |
| Password changed (`passwordChanged`) | 250 | yes |
| Login code (`twoFactorCode`) | 250 | yes |
| Address change, approval (`emailChangeConfirmation`) | 250 | yes |
| Address change, verification (`emailChangeVerification`) | 250 | yes |
| Handle changed (`handleChanged`) | 250 | yes |

**Accepted** is the receiving server's SMTP reply, read from the provider's API:
`250` means Gmail took the message on the first attempt, with no deferral and no
rejection. That is a machine-checkable fact, and it already proves SPF and DKIM
pass — Gmail defers or refuses unauthenticated mail from a domain this young.

**Inbox** is a human observation. No API reports which folder a message landed
in, so this column is the mailbox owner reading his own inbox — confirmed for
all eight on 05.09.2026. It is the column that actually answers the SPEC §10
risk; acceptance alone does not.

The verification message was additionally sent by the deployed application
itself, through a real registration, not only through the provider's API. The
rest were sent through the API with the identical envelope, because several of
them (address change, login code, handle change) can only be triggered from
inside a signed-in account and reproducing all of those states buys nothing the
envelope does not already settle.

## What was NOT measured, and why

**Onet, WP and Interia.** The original acceptance criteria named all four Polish
providers. The scope was cut to Gmail deliberately (decision of 05.09.2026):
mailboxes at the other three would have to be created purely for this test, and
Gmail is both the strictest common filter and the one most of the audience uses.
This is a recorded trade-off, not an oversight.

Reopen this if messages start being reported as missing, and test in this order:
Onet, WP, Interia. The method is above; it takes about ten minutes per provider
once a mailbox exists.

**Production, on the apex domain.** These results belong to
`dev.architektow3d.pl`, which sends nothing but test mail and therefore has no
reputation to speak of, good or bad. `architektow3d.pl` also carries OVHcloud
Zimbra, so #24 must **merge** Scaleway into the single existing SPF record —
two SPF records invalidate each other and would fail every check above at once.
Re-run this matrix after that switch.

## How to re-run it

The provider's API reports the receiving server's reply per message, which is
the half a machine can check:

```bash
curl -s -H "X-Auth-Token: $EMAIL_API_KEY" \
  "https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails?project_id=$EMAIL_PROJECT_ID&page_size=20"
```

Each entry carries `status` and `last_tries[].code`. A `250` on rank 1 is what
the table above records. Then open the mailbox and fill in the second column —
that part has no shortcut.

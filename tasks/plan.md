# Plan implementacji MVP — indeks zadań

**Zadania śledzone w GitHub Issues:** https://github.com/3dbdg/platform-lite/issues
(jedno issue = jedno zadanie z kryteriami akceptacji i weryfikacją; ten plik to indeks
i kontekst, nie druga lista — nie prowadzimy `tasks/todo.md`).

Źródłem wymagań jest [SPEC.md](../SPEC.md). Plan utworzony 30.08.2026, zatwierdzony przez Dawida.

## Decyzje strukturalne

- Wszystko na GitHubie (issues, PR-y, milestone'y, labele, commity) — **po angielsku**;
  dokumenty decyzyjne w repo — po polsku (SPEC.md §5).
- Milestone = faza; kryteria checkpointu w opisie milestone'u i poniżej.
- Zależności w treści issue („Depends on #N"). Kolejność numerów = zalecana kolejność pracy.
- Labele: `infra` (konsole OVH/Scaleway/Coolify), `decision` (pytania otwarte §12),
  `blocked` (czeka na decyzję o domenie — #25).
- Brama jakości dla każdego zadania z kodem: **`pnpm check` zielony przed każdym commitem** (§7);
  wpisana w sekcję Verification każdego issue.
- Transport poczty w dev = log (#6), więc brak domeny (#25) nie blokuje żadnego kodu aplikacji —
  blokuje wyłącznie #21 (adresy docelowe), #22 i #24.

## Fazy i checkpointy

### [Phase 0 — Foundation](https://github.com/3dbdg/platform-lite/milestone/1)

1. [#1](https://github.com/3dbdg/platform-lite/issues/1) Bootstrap: Next.js 16 + TS strict + Tailwind 4 + narzędzia
2. [#2](https://github.com/3dbdg/platform-lite/issues/2) Infrastruktura dev na OVH `waw` (`infra`)
3. [#3](https://github.com/3dbdg/platform-lite/issues/3) i18n: next-intl, `pl` bez prefiksu, `/en/`, cookie
4. [#4](https://github.com/3dbdg/platform-lite/issues/4) Schemat bazy + Drizzle + pierwsza migracja
5. [#5](https://github.com/3dbdg/platform-lite/issues/5) CI: `pnpm check` + build na każdym PR
6. [#6](https://github.com/3dbdg/platform-lite/issues/6) Warstwa e-mail: `lib/email.ts`, szablony pl/en, transport dev

**Checkpoint:** CI zielone na PR; `pnpm dev` renderuje stronę pl i en; baza dev po migracjach.

### [Phase 1 — Accounts](https://github.com/3dbdg/platform-lite/milestone/2)

7. [#7](https://github.com/3dbdg/platform-lite/issues/7) Rejestracja z weryfikacją e-mail (A1)
8. [#8](https://github.com/3dbdg/platform-lite/issues/8) Logowanie, wylogowanie, sesje (A2)
9. [#9](https://github.com/3dbdg/platform-lite/issues/9) Reset hasła (A3)
10. [#10](https://github.com/3dbdg/platform-lite/issues/10) Ustawienia konta: zmiana hasła i adresu (A10)

**Checkpoint:** pełny cykl konta na dev bez pomocy; testy integracyjne auth zielone.

### [Phase 2 — Profile and files](https://github.com/3dbdg/platform-lite/milestone/3)

11. [#11](https://github.com/3dbdg/platform-lite/issues/11) `lib/storage.ts`: `FileStorage` + S3 + `contentKey` (G1–G3)
12. [#12](https://github.com/3dbdg/platform-lite/issues/12) Upload awatara: presigned URL + warianty sharp (A4, G3–G5)
13. [#13](https://github.com/3dbdg/platform-lite/issues/13) Limit 1 GB: `lib/quota.ts` (A9)
14. [#14](https://github.com/3dbdg/platform-lite/issues/14) Ustawienia profilu: nazwa + awatar (A4)
15. [#15](https://github.com/3dbdg/platform-lite/issues/15) Handle: walidacja, słowa zarezerwowane (A5)
16. [#16](https://github.com/3dbdg/platform-lite/issues/16) Zmiana handle: cooldown, 301, zwalnianie (A6)
17. [#17](https://github.com/3dbdg/platform-lite/issues/17) Seed: `pnpm db:seed` (G7)

**Checkpoint:** nazwa, zdjęcie (warianty WebP) i handle ustawialne z UI; quota egzekwowana;
pokrycie `src/lib/` ≥ 80 %.

### [Phase 3 — Public pages](https://github.com/3dbdg/platform-lite/milestone/4)

18. [#18](https://github.com/3dbdg/platform-lite/issues/18) Wizytówka `/[handle]`: SSR, meta/OG/canonical, 301/404 (A7)
19. [#19](https://github.com/3dbdg/platform-lite/issues/19) Strona główna niezalogowanego (A11)
20. [#20](https://github.com/3dbdg/platform-lite/issues/20) E2E: happy path, smoke, axe

**Checkpoint = kryterium sukcesu MVP:** od strony głównej do publicznego linku ze zdjęciem
w < 5 minut (przejście ręczne); e2e zielone.

### [Phase 4 — Deployments and transactional email](https://github.com/3dbdg/platform-lite/milestone/5)

21. [#21](https://github.com/3dbdg/platform-lite/issues/21) Dockerfile + Coolify dev: auto-deploy, podglądy PR, G9 (`infra`)
22. [#22](https://github.com/3dbdg/platform-lite/issues/22) Scaleway TEM + SPF/DKIM/DMARC (G8) (`infra`, `blocked`)
23. [#23](https://github.com/3dbdg/platform-lite/issues/23) Test dostarczalności: Gmail/Onet/WP/Interia (`infra`)
24. [#24](https://github.com/3dbdg/platform-lite/issues/24) Prod: instancja, Managed Postgres, kubełek, CDN, ćwiczenie G10 (`infra`, `blocked`)

**Checkpoint:** dev auto-deploy z `main` + podglądy PR; poczta przechodzi testy dostarczalności;
procedura G10 przećwiczona; prod gotowy do ręcznego wdrożenia (każde — za zgodą, §7).

### Decyzje otwarte (label `decision`, §12)

- [#25](https://github.com/3dbdg/platform-lite/issues/25) Nazwa produktu i domena — **blokuje #21 (adresy), #22, #24**; przed pierwszym wdrożeniem dev
- [#26](https://github.com/3dbdg/platform-lite/issues/26) Projekt strony głównej (zdjęcie, licencja) — placeholder w #19 nie czeka
- [#27](https://github.com/3dbdg/platform-lite/issues/27) Domyślny obraz OG bez awatara — #18 startuje z placeholderem

## Pokrycie wymagań

Każde kryterium A1–A11 i każda granica G1–G10 ma swoje zadanie (A11 — wizualne, bez wymogu
testu). Ryzyka §10 ujęte w #23 (dostarczalność) i treściach #16/#24. Pytania §12 = #25–#27.

## Ryzyka planu

| Ryzyko | Mitygacja |
|---|---|
| Brak decyzji o domenie zatrzymuje fazę 4 | #25 oznaczone jako blokujące; fazy 0–3 w całości niezależne od domeny (transport log w #6) |
| Better Auth: API/wersja niezweryfikowane | W #4/#7 jawny krok weryfikacji z oficjalną dokumentacją przed implementacją (§2, source-driven) |
| Infrastruktura (#2) ręczna, po stronie Dawida | #2 bez zależności — można zrobić równolegle z #1; kroki dokumentowane w `docs/` pod G10 |

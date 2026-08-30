# Spec: platform-lite — MVP

Repozytorium: https://github.com/3dbdg/platform-lite
Status: **do zatwierdzenia** · 30 sierpnia 2026 · nic nie jest jeszcze zaimplementowane.
Nazwa robocza: *platform-lite* (nazwa produktu i domena — otwarte, patrz §12).

Dokumenty źródłowe z pełnym uzasadnieniem decyzji:
- Karta decyzji: https://claude.ai/code/artifact/e08d7ff7-26e1-4b7c-8ead-260200b040d1
- Koszty plików i transferu (14 dostawców): https://claude.ai/code/artifact/931d4f6c-1676-44dc-8076-023883402d74
- Koszty poczty transakcyjnej (8 dostawców): https://claude.ai/code/artifact/70cbb3dd-5d94-42a4-90b1-2bc7f34b637a

Rodowód: MVP odpowiada modułom `foundation → identity → profiles` z zatwierdzonej mapy
zdolności repozytorium `3dbdg/platform` (CAPABILITY-MAP.md). Świadomie scalone tu w jedną
aplikację i jeden spec — to jest sedno „lite".

---

## 1. Cel

Pracownia architektoniczna albo artysta 3D wchodzi na platformę i w kilka minut ma
publiczną wizytówkę pod adresem `/nazwa` — wygląd inspirowany stroną firmową LinkedIn
(sam styl wizualny: niebieski akcent, gęstsza typografia, karty z cienkimi obramowaniami;
bez struktury strony firmowej — bez zdjęcia w tle, zakładek i sekcji „O nas").

**Jedna persona:** dostawca — pracownia albo solowy twórca. Rynek: Polska, potem Europa.

**Sukces MVP:** nowy użytkownik bez żadnej pomocy przechodzi od wejścia na stronę główną
do działającego publicznego linku ze swoją nazwą i zdjęciem w mniej niż 5 minut.

### Kryteria akceptacyjne

| # | Kryterium |
|---|---|
| A1 | Rejestracja e-mail + hasło (8–128 znaków, bez reguł kompozycji, limitowanie prób). Konto nieaktywne do kliknięcia linku weryfikacyjnego (ważny 24 h, ponowna wysyłka maks. 3/h). |
| A2 | Logowanie i wylogowanie. Sesja: cookie `httpOnly` + `secure` + `sameSite=lax`, 30 dni, odnawialna. Hashe haseł wyłącznie w naszym Postgresie. |
| A3 | Reset hasła: link jednorazowy ważny 60 min; po udanej zmianie powiadomienie na adres konta. |
| A4 | Profil: nazwa wyświetlana (1–80 znaków) i zdjęcie (JPEG/PNG/WebP ≤ 10 MB), z którego powstają warianty WebP 512 px i 128 px. |
| A5 | Handle: 3–30 znaków, `^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$`, unikalność bez rozróżniania wielkości liter, lista słów zarezerwowanych (m.in. `pl`, `en`, `api`, `admin`, `login`, `settings`, `assets`). |
| A6 | Zmiana handle: nie częściej niż raz na 30 dni. Stary adres odpowiada 301 na nowy, **dopóki ktoś nie zajmie starej nazwy — stare handle wracają do obiegu natychmiast** (decyzja 30.08.2026; ryzyko podszycia przyjęte świadomie, patrz §10). |
| A7 | Wizytówka `/nazwa`: renderowana serwerowo, poprawne `<title>`, opis, Open Graph (obraz = awatar), canonical. Indeksowana **wyłącznie na produkcji** — dev i podglądy PR wysyłają `X-Robots-Tag: noindex`. |
| A8 | Interfejs po polsku i angielsku, architektura otwarta na kolejne języki: wszystkie teksty przez słowniki, żadnych napisów w komponentach. Polski bez prefiksu (`/nazwa`), angielski z prefiksem (`/en/...`), wybór: nagłówek `Accept-Language` + przełącznik zapisywany w cookie. |
| A9 | Limit 1 GB na użytkownika, za darmo (MVP nie ma płatności). Zużycie liczone w bazie z rozmiarów plików; upload ponad limit odrzucony z czytelnym komunikatem. |
| A10 | Sześć e-maili transakcyjnych (weryfikacja, ponowna weryfikacja, reset, potwierdzenie zmiany hasła, zmiana adresu ×2, zmiana handle) przez Scaleway TEM. SPF, DKIM i DMARC skonfigurowane, zanim wyjdzie pierwszy prawdziwy list. Zero e-maili marketingowych. |
| A11 | Strona główna dla niezalogowanego: pełnoekranowe zdjęcie + wejście do rejestracji/logowania. Projekt graficzny — otwarty (§12); w MVP placeholder zgodny ze stylem. |

---

## 2. Stack

Wersje sprawdzone w sierpniu 2026 — przy starcie implementacji zweryfikować bieżące
wydania w oficjalnej dokumentacji (zasada source-driven).

| Warstwa | Wybór | Uzasadnienie skrótowe |
|---|---|---|
| Framework | **Next.js 16 (LTS, App Router)** + TypeScript strict | SSR dla SEO wizytówek; największy korpus dobrego kodu = mniej błędów przy pracy z Claude Code. |
| Runtime | Node.js 24 LTS, pnpm ≥ 11 | |
| Baza | **PostgreSQL 17** + **Drizzle ORM** | Prod: OVH Managed (1 węzeł + backupy). Dev: kontener na instancji dev. Migracje w plikach (G6). |
| Auth | **Better Auth** — e-mail + hasło, sesje cookie | Hashe u nas → zerowy lock-in na najwrażliwszej warstwie. Wersję i API zweryfikować przy starcie. |
| i18n | **next-intl** | `messages/pl.json`, `messages/en.json`; strategia prefiksów jak w A8. |
| Pliki | **OVHcloud Object Storage (S3)** za własnym interfejsem (G1) | Najtańszy w UE, **zerowy egress** (zniesiony I 2026; fair use potwierdzone u OVH 30.08.2026). |
| Obrazy | **sharp** przy uploadzie | Warianty WebP 512/128, nazwy = skrót treści (G2). |
| CDN | OVHcloud CDN | Włączany dopiero przy starcie produkcyjnym. |
| Poczta | **Scaleway TEM** | Bez opłaty stałej, 300 listów gratis, €0,25/1000; spółka FR, DC Warszawa. |
| Style | **Tailwind CSS 4** + własne prymitywy | Mały design system, pełna kontrola nad stylem LinkedIn-like. |
| Walidacja | **Zod** — te same schematy klient/serwer | |
| Testy | **Vitest** + **Playwright** (+ @axe-core/playwright) | |
| Wdrożenia | **Docker + Coolify** | `git push` = deploy, podgląd każdego PR, cofnięcie = poprzedni obraz. |
| Serwery | **OVHcloud Public Cloud** | Prod: `eu-west-par` (3-AZ). Dev: `waw` (najniższe opóźnienie z PL). |

Reguła nadrzędna, która rządziła wyborami: **żadna warstwa nie może mieć kosztu wyjścia
większego niż tydzień pracy.** Stąd czysty Postgres, standard S3, obraz Dockera, własne auth.

Koszty: ~€9/mies. w fazie budowy, ~€105/mies. po starcie (rozbicie w karcie decyzji).

---

## 3. Komendy

```
pnpm dev              # serwer deweloperski
pnpm build            # build produkcyjny
pnpm start            # uruchomienie builda

pnpm lint             # eslint . --max-warnings 0
pnpm lint:fix
pnpm format           # prettier --write .
pnpm typecheck        # tsc --noEmit

pnpm test             # vitest run
pnpm test:watch
pnpm test:coverage    # vitest run --coverage
pnpm test:e2e         # playwright test

pnpm db:generate      # drizzle-kit generate (schemat → migracja SQL)
pnpm db:migrate       # zastosuj migracje na bazie z DATABASE_URL
pnpm db:seed          # dane testowe: kilkanaście profili ze zdjęciami (G7)
pnpm db:studio        # drizzle-kit studio

pnpm check            # typecheck && lint && test  ← brama przed każdym commitem
```

Lokalnie **bez Dockera** — praca na zdalnej bazie i zdalnym S3 (region `waw`).
Obraz produkcyjny buduje Coolify z `Dockerfile` w korzeniu repo (Next.js `standalone`).

---

## 4. Struktura projektu

```
src/
  app/
    (public)/
      page.tsx              # strona główna niezalogowanego (A11)
      [handle]/page.tsx     # wizytówka (A7)
    (auth)/                 # rejestracja, logowanie, weryfikacja, reset
    (app)/settings/         # profil, handle, konto
    api/                    # route handlers (upload confirm itd.)
  lib/
    storage.ts              # G1: JEDYNE miejsce dotykające S3
    email.ts                # jedyne miejsce dotykające Scaleway TEM
    handle.ts               # walidacja, słowa zarezerwowane, cooldown
    quota.ts                # liczenie zużycia (A9)
  db/
    schema.ts               # źródło prawdy dla drizzle-kit
  i18n/                     # konfiguracja next-intl
messages/
  pl.json  en.json          # WSZYSTKIE teksty interfejsu
drizzle/                    # wygenerowane migracje SQL — commitowane
e2e/                        # testy Playwright
docs/                       # decyzje, archiwum
Dockerfile
.env.example                # DATABASE_URL, S3_ENDPOINT/REGION/BUCKET/KEY/SECRET,
                            # EMAIL_* (TEM), APP_URL, AUTH_SECRET — bez wartości
```

Środowiska plikowe: kubełek `platform-dev` (prefiksy per deweloper i per PR, np.
`dawid/`, `pr-7/`) i **osobny** kubełek `platform-prod` z osobnymi kluczami — klucz
deweloperski fizycznie nie może dotknąć plików produkcyjnych.

---

## 5. Styl kodu

- TypeScript strict; `any` zakazane (wyjątki tylko z komentarzem uzasadniającym).
- Identyfikatory, komentarze i commity kodu — po angielsku. Teksty UI — tylko przez
  słowniki (A8). Komunikacja i dokumenty decyzyjne — po polsku.
- Server Components domyślnie; `"use client"` tylko tam, gdzie jest interakcja.
- Walidacja wejścia na brzegu (Zod), typy wyprowadzane ze schematów.
- Formatowanie: Prettier (domyślne) + ESLint bez warningów.

Wzorzec — cienki interfejs storage (G1) i styl nazewnictwa:

```ts
// src/lib/storage.ts — the ONLY file that talks to S3.
export interface FileStorage {
  presignUpload(key: string, opts: { maxBytes: number; contentType: string }): Promise<string>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  publicUrl(key: string): string; // stable, unsigned (G3)
}

export function contentKey(hash: string, ext: string, prefix = ""): string {
  // G2: content-addressed name → served with max-age=31536000, immutable
  return `${prefix}a/${hash}.${ext}`;
}
```

---

## 6. Strategia testów

| Poziom | Narzędzie | Zakres | Gdzie |
|---|---|---|---|
| Jednostkowe | Vitest | `lib/handle` (regex, słowa zarezerwowane, cooldown), `lib/quota`, `contentKey`, warianty obrazów | `src/**/*.test.ts` obok kodu |
| Integracyjne | Vitest + testowa baza | przepływy auth, zmiana handle z 301, licznik zużycia | `DATABASE_URL_TEST` → osobna baza `platform_test_<dev>` na serwerze dev |
| E2E | Playwright | ścieżka szczęśliwa: rejestracja → weryfikacja → profil → publiczna wizytówka; smoke logowania i resetu; axe na stronach publicznych | `e2e/` |

- Pokrycie: bez fetyszu procentów; twarde minimum **80 % dla `src/lib/`** oraz test dla
  każdego kryterium A1–A10 (A11 — wizualne, bez wymogu).
- CI (GitHub Actions): `pnpm check` + build na każdym PR; Postgres jako service container;
  e2e smoke na PR, pełne e2e przed wdrożeniem prod.
- Naprawa błędu zaczyna się od testu, który go odtwarza.

---

## 7. Granice

**Zawsze (G1–G10 — numeracja wspólna z kartą decyzji):**

- **G1** Storage za cienkim interfejsem — S3 wołane wyłącznie z `lib/storage.ts`.
- **G2** Nazwa pliku = skrót zawartości; serwowane z `max-age=31536000, immutable`.
- **G3** Publiczne zdjęcia mają stałe, niepodpisane adresy; podpisy tylko dla uploadu.
- **G4** Pliki użytkowników nigdy nie przechodzą przez serwer aplikacji (upload przez
  presigned URL; warianty generowane po stronie serwera z kopii pobranej siecią wewnętrzną).
- **G5** Warianty rozmiarów + format nowej generacji dla każdego obrazu serwowanego publicznie.
- **G6** Zmiany schematu bazy wyłącznie przez migracje w plikach.
- **G7** `pnpm db:seed` utrzymywany na bieżąco — świeże środowisko w minutę.
- **G8** SPF, DKIM, DMARC skonfigurowane przed pierwszym prawdziwym e-mailem.
- **G9** Panel Coolify: 2FA + ograniczenie IP; nigdy otwarty na świat.
- **G10** Procedura odtworzenia instancji zapisana w `docs/` i raz przećwiczona.
- Ponadto: `pnpm check` przed każdym commitem; wszystkie teksty przez słowniki;
  commity opisowe; sekrety tylko w zmiennych środowiskowych.

**Zapytaj najpierw:**

- nowa zależność produkcyjna; zmiana wersji major frameworka/bazy;
- zmiany w schemacie auth/sesji;
- wszystko, co tworzy nową usługę albo koszt u dostawcy;
- każde wdrożenie na prod; zmiany konfiguracji CI.

**Nigdy:**

- sekrety w repozytorium (`.env` w `.gitignore`; `.env.example` bez wartości);
- podpisane URL-e na publicznych zdjęciach (G3) ani pliki przez aplikację (G4);
- usuwanie lub pomijanie czerwonych testów bez zgody;
- usługi spoza UE/EOG w ścieżce danych osobowych;
- e-mail marketingowy z infrastruktury transakcyjnej;
- `git push --force` na `main`.

---

## 8. Środowiska i wdrożenia

| Środowisko | Gdzie | Baza | Wdrożenie |
|---|---|---|---|
| Lokalne | komputer dewelopera | zdalna `waw` (per deweloper: `platform_<imię>`) | — |
| Podgląd PR | instancja dev | wspólna dev | automatycznie przy otwarciu PR, kasowane po scaleniu |
| Dev | OVH `waw`, d2-2 (€7) | Postgres w kontenerze | automatycznie z `main` |
| Prod | OVH `eu-west-par`, b3-8 (€35) | Managed PostgreSQL (€59) | **ręcznie**: przycisk w Coolify albo tag `vX.Y.Z` |

- Nic nie „przenosi się" z dev na prod — oba budują się z Gita; struktura bazy podróżuje
  migracjami, dane nigdy.
- Poza prod: `X-Robots-Tag: noindex` (A7).
- Odporność: zimna rezerwa (migawka + procedura G10). Świadomie bez load balancera
  i drugiego węzła bazy — potroiłyby koszt, chroniąc ruch bliski zeru.

---

## 9. Model danych (zarys — źródłem prawdy są migracje)

- `users`, `sessions`, `verifications` — tabele Better Auth (hasła: scrypt/argon2 wg biblioteki).
- `profiles`: `user_id PK/FK`, `display_name`, `handle` (unikalny po `lower()`),
  `handle_changed_at`, `avatar_file_id`.
- `handle_redirects`: `old_handle PK`, `target_user_id`, `created_at`.
  Rozwiązywanie `/X`: profil → przekierowanie (301 na aktualny handle celu) → 404.
  Rejestracja handle `X` przez kogokolwiek **usuwa** wiersz przekierowania (A6).
- `files`: `id`, `user_id`, `sha256`, `size_bytes`, `kind` (`avatar-original|avatar-512|avatar-128`),
  `created_at`. Suma `size_bytes` per user = zużycie limitu (A9).

---

## 10. Ryzyka przyjęte świadomie

| Ryzyko | Decyzja |
|---|---|
| Natychmiastowy powrót starych handle do obiegu → możliwość podszycia się pod porzucony adres | Decyzja z 30.08.2026. Do rewizji, gdy pojawią się realne profile z reputacją. |
| Jedna instancja aplikacji, jeden węzeł bazy | Zimna rezerwa + backupy. HA dopiero, gdy przerwa zacznie kosztować więcej niż €56/mies. |
| Darmowy 1 GB dla każdego | Bezpieczne dzięki zerowemu egressowi OVH; próg bólu ~10 000 kont (~€75/mies.) — wtedy rozmowa o modelu płatnym. |
| Dostarczalność Scaleway TEM na polskie skrzynki niezweryfikowana | Test na Gmail/Onet/WP/Interia przed startem; plan B: EmailLabs (zmiana konfiguracji SMTP). |
| 100 MB/odsłonę to szacunek, nie pomiar | Zweryfikować telemetrią po starcie. |

---

## 11. Świadomie poza zakresem

Płatności i plany · katalog/wyszukiwarka dostawców · persona dewelopera (druga strona
rynku) · silnik makiet 3D i marketplace · zdjęcie w tle profilu, zakładki, sekcja „O nas",
aktualności, zespół · przełącznik szkic/opublikowany · wiadomości i formularz kontaktowy ·
obserwowanie · konta zespołowe · własna domena użytkownika · panel administratora ·
analityka produktowa · compliance ponad minimum (dane osobowe trzymamy rozdzielnie, żeby
dało się dołożyć bez przebudowy) · HA/multicloud/Terraform · Docker i MinIO lokalnie.

---

## 12. Otwarte pytania

- [ ] **Nazwa produktu i domena** — blokuje adres nadawcy poczty (G8), adres panelu
      i wizytówek. Do rozstrzygnięcia przed pierwszym wdrożeniem dev.
- [ ] Projekt strony głównej niezalogowanego (A11): pełnoekranowe zdjęcie — jakie, skąd,
      na jakiej licencji.
- [ ] Wybór konkretnego zdjęcia OG dla wizytówek bez awatara.

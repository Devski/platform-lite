# ARCHIWUM: odrzucona alternatywa (Cloudflare free tier)

> Spec wygenerowany 30.08.2026 ok. 01:35, przed podjęciem decyzji o stacku.
> Zakładał Cloudflare Workers (plan darmowy), React Router v7, D1 i logowanie bez haseł.
> Odrzucony na rzecz OVHcloud + Next.js — pełne uzasadnienie w SPEC.md i karcie decyzji.

# Spec: platform-lite (MVP)

Repozytorium: https://github.com/3dbdg/platform-lite
Status: **do zatwierdzenia** — nic nie jest jeszcze zaimplementowane.
Data: 2026-08-30

---

## 1. Cel

Platforma, na której **firma architektoniczna lub artysta 3D** zakłada konto i w kilka
minut ma własną stronę-wizytówkę pod publicznym adresem — odpowiednik profilu
LinkedIn, ale skupiony na wizualnej prezentacji.

**Jedna persona (MVP):** Ania, prowadzi 3-osobową pracownię architektoniczną.
Ma portfolio na Behance i profil na Instagramie, ale nie ma własnej strony,
bo WordPress to dla niej za dużo roboty. Chce adres, który wkleja w stopce maila.

**Historyjki użytkownika (pełny zakres MVP):**

| # | Jako… | Chcę… | Żeby… |
|---|---|---|---|
| U1 | nowy użytkownik | założyć konto e-mailem bez wymyślania hasła | wejść w 30 sekund |
| U2 | wracający użytkownik | zalogować się tym samym sposobem | nie pamiętać niczego |
| U3 | zalogowany | ustawić nazwę wyświetlaną i zdjęcie | profil wyglądał jak mój |
| U4 | zalogowany | wybrać adres `/u/moja-pracownia` | mieć link do wklejenia |
| U5 | zalogowany | opublikować profil jednym kliknięciem | nie wystawiać niedokończonego |
| U6 | ktokolwiek w internecie | zobaczyć opublikowany profil bez logowania | Ania mogła go komukolwiek wysłać |

**Sukces MVP** = Ania trafia na stronę główną i w mniej niż 3 minuty, bez pomocy,
ma działający publiczny link ze swoją nazwą i zdjęciem.

### Świadomie POZA zakresem MVP

Portfolio i galerie projektów · wyszukiwarka i katalog studiów · wiadomości i kontakt ·
obserwowanie i polubienia · zespoły oraz konta firmowe z wieloma użytkownikami ·
płatności i plany · własna domena użytkownika · i18n (MVP tylko po polsku) ·
panel administratora · RODO ponad minimum · SOC2/ISO · multicloud · analityka produktowa.

Te rzeczy prawdopodobnie przyjdą — spec ma je **nie blokować**, ale ich nie realizuje.

---

## 2. Stack i uzasadnienie

Twarde ograniczenie: **hosting na Cloudflare, plan darmowy, z ich CDN.**
To nie jest szczegół implementacyjny — to ono podyktowało trzy decyzje poniżej.

| Warstwa | Wybór | Dlaczego |
|---|---|---|
| Framework | **React Router v7** (framework mode) + TypeScript | SSR dla SEO profili, oficjalny adapter Cloudflare, bundle rzędu 0,5 MB — mieści się w limicie 3 MB. Ekosystem React = łatwo dobierać ludzi i biblioteki. |
| Runtime i hosting | **Cloudflare Workers + Static Assets** | CDN wliczony, statyki nie zużywają limitu requestów. |
| Baza | **Cloudflare D1** (SQLite) + **Drizzle ORM** | Natywna dla Workers, zero kosztu, zero latencji sieciowej. Drizzle sprawia, że przejście na Postgres to podmiana dialektu, nie przepisanie aplikacji. |
| Auth | **better-auth**: magic link + Google OAuth | **Bez haseł — decyzja wymuszona limitem 10 ms CPU na request w planie free.** bcrypt i argon2 się w nim nie mieszczą. Efekt uboczny: zero hashy do wycieku. |
| Pliki | **Cloudflare R2** + skalowanie po stronie klienta | 10 GB gratis, zero opłat za egress. Transformacje obrazów w Cloudflare są płatne, więc skalujemy w przeglądarce przed uploadem. |
| Mail | **Resend** (free: 3 000/mies.) | Magic linki muszą dochodzić. MailChannels przestał być darmowy. |
| Style | **Tailwind CSS v4** + własne prymitywy UI | Bez biblioteki komponentów — design system jest mały i chcemy nad nim kontroli. |
| Walidacja | **Zod** — te same schematy na kliencie i serwerze | Jedno źródło prawdy dla formularzy. |

**Odrzucone świadomie:**

- *Next.js przez OpenNext* — działa na Workers, ale bundle regularnie ociera się o
  limit 3 MB planu darmowego. Nie chcę, żeby pierwszą ścianą był rachunek za hosting.
- *Supabase / Neon* — świetne, ale to zewnętrzny hop sieciowy z Workera i drugi
  dostawca do pilnowania. D1 leży w tym samym runtime.
- *Hasła* — patrz wyżej, limit CPU.

**Ścieżka wzrostu** (nie robimy tego teraz, ale nic tego nie blokuje):
plan Workers Paid (5 USD) znosi limity CPU i bundle → wtedy hasła i cięższe operacje ·
D1 → Postgres przez Hyperdrive, gdy przekroczymy 500 MB · R2 → Cloudflare Images,
gdy zdjęć będzie dużo · better-auth ma adaptery do obu baz.

---

## 3. Komendy

```
npm run dev              # serwer deweloperski (Vite + runtime Workers)
npm run build            # build produkcyjny
npm run typecheck        # react-router typegen && tsc --noEmit
npm run lint             # eslint . --max-warnings 0
npm run format           # prettier --write .

npm test                 # vitest run
npm run test:watch       # vitest
npm run test:e2e         # playwright test
npm run test:coverage    # vitest run --coverage

npm run db:generate      # drizzle-kit generate  (schemat -> migracja SQL)
npm run db:migrate       # wrangler d1 migrations apply platform-lite --local
npm run db:migrate:prod  # wrangler d1 migrations apply platform-lite --remote
npm run db:studio        # drizzle-kit studio

npm run deploy           # npm run build && wrangler deploy
npm run check            # typecheck && lint && test   <- brama przed commitem
```

---

## 4. Struktura projektu

```
platform-lite/
├── app/
│   ├── routes/
│   │   ├── home.tsx                  # landing, look&feel Airbnb, CTA "Załóż wizytówkę"
│   │   ├── auth.login.tsx            # jeden ekran: e-mail albo Google
│   │   ├── auth.verify.tsx           # "sprawdź skrzynkę" + obsługa powrotu z linku
│   │   ├── auth.$.tsx                # handler better-auth (callbacki OAuth, sesje)
│   │   ├── app.layout.tsx            # layout chroniony, wymaga sesji
│   │   ├── app.profile.tsx           # edytor: nazwa, zdjęcie, adres, publikacja
│   │   └── u.$slug.tsx               # PUBLICZNY profil, SSR, bez wymogu sesji
│   ├── components/
│   │   ├── ui/                       # Button, Input, Card, Avatar, Toast — prymitywy
│   │   └── profile/                  # AvatarUploader, ProfilePreview, SlugField
│   ├── lib/
│   │   ├── auth.server.ts            # konfiguracja better-auth
│   │   ├── db.server.ts              # klient Drizzle na D1
│   │   ├── storage.server.ts         # upload i odczyt z R2
│   │   ├── slug.ts                   # normalizacja i walidacja adresu (izomorficzne)
│   │   └── image.ts                  # skalowanie w przeglądarce przed uploadem
│   ├── styles/app.css                # Tailwind + tokeny designu
│   ├── root.tsx
│   └── routes.ts                     # deklaracja tras
├── db/
│   ├── schema.ts                     # schemat Drizzle — JEDYNE źródło prawdy o modelu
│   └── migrations/                   # generowane, commitowane, nigdy edytowane ręcznie
├── workers/app.ts                    # entry point Workera
├── tests/                            # testy jednostkowe, lustrzane do app/
├── e2e/                              # scenariusze Playwright
├── public/                           # statyki serwowane z CDN
├── wrangler.jsonc                    # bindingi: DB (D1), BUCKET (R2), sekrety
├── SPEC.md                           # ten plik
└── README.md                         # jak odpalić lokalnie
```

---

## 5. Model danych

Tabele `user`, `session`, `account`, `verification` są zarządzane przez better-auth —
schematu nie piszemy ręcznie. Nasza jedyna tabela:

```ts
// db/schema.ts
export const profiles = sqliteTable('profiles', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:      text('user_id').notNull().unique()
                 .references(() => user.id, { onDelete: 'cascade' }),
  slug:        text('slug').notNull().unique(),        // [a-z0-9-]{3,40}
  displayName: text('display_name').notNull(),         // 2-80 znaków
  avatarKey:   text('avatar_key'),                     // klucz w R2, null = inicjały
  published:   integer('published', { mode: 'boolean' }).notNull().default(false),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:   integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (t) => [index('profiles_slug_idx').on(t.slug)]);
```

Profil powstaje automatycznie przy pierwszym logowaniu (`slug` losowy, `published` = false).
Użytkownik go potem nazywa i publikuje. Dzięki temu edytor nigdy nie musi obsługiwać
stanu „użytkownik bez profilu".

---

## 6. Design — język wizualny

Referencja: Airbnb. **Nie kopiujemy ich brandingu** (logo, firmowy koral, krój Cereal) —
bierzemy język: biel, oddech, zaokrąglenia, zdjęcie na pierwszym planie.

```css
/* app/styles/app.css */
@theme {
  --color-ink:      #222222;   /* tekst główny */
  --color-muted:    #717171;   /* tekst drugorzędny */
  --color-line:     #DDDDDD;   /* obramowania */
  --color-canvas:   #FFFFFF;
  --color-accent:   #E0533D;   /* nasz akcent — ciepły, ale nie firmowy koral Airbnb */
  --radius-card:    16px;
  --radius-control: 12px;
  --shadow-card:    0 6px 16px rgba(0,0,0,.12);
  --font-sans:      Inter, -apple-system, system-ui, sans-serif;
}
```

Zasady, których się trzymamy: skala odstępów co 8 px · maksymalna szerokość treści
1120 px · przyciski 48 px wysokości z `--radius-control` · karty na bieli z cienką linią,
cień pojawia się na hover · zdjęcie zawsze przed tekstem w hierarchii ·
maksymalnie jeden akcent kolorystyczny na ekran · stan focus widoczny zawsze
(nigdy `outline: none` bez zamiennika).

---

## 7. Styl kodu

```tsx
// app/routes/u.$slug.tsx — wzorzec każdej trasy: loader -> komponent, bez wyjątków
import type { Route } from './+types/u.$slug';
import { getProfileBySlug } from '~/lib/profiles.server';

export async function loader({ params, context }: Route.LoaderArgs) {
  const profile = await getProfileBySlug(context.db, params.slug);
  if (!profile || !profile.published) {
    throw new Response('Nie znaleziono', { status: 404 });
  }
  return { profile };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: 'Nie znaleziono — platform-lite' }];
  return [
    { title: `${data.profile.displayName} — platform-lite` },
    { property: 'og:image', content: avatarUrl(data.profile.avatarKey) },
  ];
}

export default function PublicProfile({ loaderData }: Route.ComponentProps) {
  const { profile } = loaderData;
  return <ProfileCard profile={profile} />;
}
```

Konwencje: nazwy plików `kebab-case`, komponenty `PascalCase`, funkcje `camelCase` ·
sufiks `.server.ts` dla kodu, który nigdy nie trafia do przeglądarki · `~/` jako alias
do `app/` · **żadnego `any`** — `unknown` plus zawężenie typu · dane z zewnątrz przechodzą
przez Zod, nie przez rzutowanie · błędy zwracamy jako `Response` z kodem, nie jako
`{ error: string }` · komentujemy *dlaczego*, nigdy *co* · teksty UI po polsku,
identyfikatory i kod po angielsku.

---

## 8. Strategia testów

| Poziom | Narzędzie | Co pokrywa | Gdzie |
|---|---|---|---|
| Jednostkowe | Vitest | logika czysta: normalizacja slugów, schematy Zod, skalowanie obrazu, reguły widoczności | `tests/` |
| Integracyjne | Vitest + `@cloudflare/vitest-pool-workers` + lokalne D1 | loadery i akcje na prawdziwej bazie: tworzenie profilu, kolizja slugów, autoryzacja edycji | `tests/` |
| E2E | Playwright (Chromium + mobile WebKit) | U1–U6 od kliknięcia do kliknięcia, magic link przechwytywany z testowego transportu maili | `e2e/` |

**Bezwzględnie musi mieć test** (miejsca, w których błąd boli):
autoryzacja — user A nie może edytować profilu usera B · unikalność i normalizacja sluga ·
niepublikowany profil zwraca 404 dla obcego · walidacja uploadu: typ MIME, rozmiar, wymiary ·
wygasły i zużyty magic link zostają odrzucone.

Cel pokrycia: **80% linii w `app/lib/`** (logika). Komponentów UI nie gonimy procentami —
od tego jest Playwright. Brama: `npm run check` musi przechodzić przed każdym commitem.

---

## 9. Granice

**Zawsze:**

- `npm run check` przed commitem; czerwony build się nie commituje
- migracje bazy generowane przez `drizzle-kit`, commitowane, aplikowane najpierw lokalnie
- każdy input z zewnątrz walidowany Zodem po stronie serwera (walidacja kliencka to UX, nie ochrona)
- każdy loader i każda akcja pod `app.*` sprawdza sesję **i własność zasobu**
- commity po polsku, tryb rozkazujący, jedna zmiana logiczna na commit
- praca na branchu `feat/*` lub `fix/*`, PR do `main`

**Pytaj najpierw:**

- dodanie zależności do `package.json` (każda waży w limicie 3 MB)
- zmiana schematu bazy po pierwszym deployu produkcyjnym
- cokolwiek, co wychodzi poza darmowe limity Cloudflare
- zmiana zakresu MVP — dopisanie funkcji z listy „poza zakresem"
- konfiguracja domeny, DNS, rekordów mailowych
- zmiana w `wrangler.jsonc` (bindingi, sekrety, routing)

**Nigdy:**

- sekrety w repo — wyłącznie `wrangler secret put` i `.dev.vars` (w `.gitignore`)
- ręczna edycja plików w `db/migrations/`
- wyłączanie testu, żeby przejść build (napraw albo zgłoś)
- `git push --force` na `main`
- kopiowanie assetów Airbnb: logo, ikon, zdjęć, firmowego koloru
- logowanie danych osobowych (e-maile, tokeny) do konsoli Workera
- `any` i `@ts-ignore` bez komentarza z uzasadnieniem

---

## 10. Kryteria akceptacji MVP

Sprawdzalne, nie uznaniowe:

1. Nowy użytkownik przechodzi rejestrację → nazwa → zdjęcie → publikacja w **poniżej 3 minut**,
   bez instrukcji. Weryfikacja: testy Playwright U1–U6 na zielono plus jeden przebieg z żywym człowiekiem.
2. `GET /u/<slug>` opublikowanego profilu zwraca **200** z nazwą i zdjęciem w źródle HTML
   (nie doklejone JS-em) — sprawdzalne przez `curl`.
3. `GET /u/<slug>` nieopublikowanego lub nieistniejącego zwraca **404**.
4. Użytkownik A dostaje **403** przy próbie edycji profilu B (test integracyjny).
5. Upload przyjmuje JPEG/PNG/WebP do 5 MB, odrzuca resztę z czytelnym komunikatem;
   po stronie klienta obraz jest skalowany do 512×512 WebP przed wysyłką.
6. Bundle Workera **poniżej 3 MB** skompresowany (`wrangler deploy --dry-run` to raportuje).
7. CPU na request **poniżej 10 ms** na trasach publicznych (metryki Cloudflare po deployu).
8. Lighthouse na `/u/<slug>`: **performance ≥ 90, accessibility ≥ 95** na mobile.
9. Cały MVP mieści się w darmowych planach — **rachunek 0 zł**.
10. `npm run check` zielone; pokrycie `app/lib/` ≥ 80%.

---

## 11. Pytania otwarte

1. **R2 wymaga karty w koncie Cloudflare** — nie ma opłaty w ramach 10 GB, ale kartę
   trzeba podpiąć. Jeśli to problem: alternatywą jest trzymanie awatarów jako BLOB
   w D1 (przy 40 KB na zdjęcie mieści się około 10 tys. profili w limicie 500 MB).
   Brzydsze i trudniejsze do migracji, ale w 100% bez karty. **Którą drogą?**
2. **Domena** — pod czym to ma stać? Bez własnej domeny Resend nie wyśle magic linków
   z sensownego adresu, a `*.workers.dev` w mailach częściej ląduje w spamie.
3. **Google OAuth** — potwierdzasz? To dodatkowa konfiguracja w Google Cloud, ale
   podnosi konwersję rejestracji. Jeśli nie, MVP jedzie na samym magic linku.
4. **Nazwa produktu w UI** — na razie w tekstach jest „platform-lite", czyli nazwa repo,
   nie produktu.
5. **Brak haseł** — akceptujesz, czy hasła są wymogiem biznesowym? Jeśli wymogiem,
   trzeba wejść na Workers Paid (5 USD/mies.) już na starcie.

---

## 12. Plan wdrożenia (szkic — do rozpisania po zatwierdzeniu specu)

Kolejność wymuszona zależnościami; każdy etap kończy się czymś działającym.

| # | Etap | Kończy się tym, że… |
|---|---|---|
| 0 | Szkielet: RRv7 + Workers + Tailwind + CI | `npm run deploy` wystawia „Hello" pod URL-em |
| 1 | Baza: D1 + Drizzle + migracje | schemat `profiles` żyje lokalnie i na produkcji |
| 2 | Auth: better-auth + magic link + Resend | da się zalogować i wylogować, sesja trzyma |
| 3 | Profil: automatyczne tworzenie + edytor nazwy | zalogowany zmienia nazwę i widzi ją po odświeżeniu |
| 4 | Zdjęcie: skalowanie w kliencie + R2 + serwowanie | awatar leci na R2 i wraca z CDN |
| 5 | Publiczny profil `/u/:slug` + slug + publikacja | link działa w trybie incognito |
| 6 | Landing w stylu Airbnb + meta i OG | strona główna sprzedaje produkt, link ładnie się wkleja |
| 7 | Domknięcie: e2e U1–U6, Lighthouse, budżet bundla | kryteria z §10 odhaczone |

Etapy 0–2 są sekwencyjne. Od etapu 3 landing (6) można robić równolegle.

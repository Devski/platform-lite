# Eksport design systemu Architektów 3d → `design/` w `Devski/platform-lite`

Stan z 14.09.2026. Ten katalog wrzucasz do repo **w całości** jako `design/` (korzeń repo), commit „design: eksport design systemu 14.09”.

## Co jest w środku

| Ścieżka | Co to | Dla kogo |
|---|---|---|
| `styles.css`, `tokens/*.css` | Wszystkie tokeny (158) w kolejności importu | PR tokens — port 1:1 |
| `components/**/*.jsx` + `.d.ts` + `.prompt.md` | Referencyjne implementacje (inline style, każdy wymiar wprost) | prymitywy |
| `_ds_bundle.js` | Skompilowane komponenty — potrzebny, żeby kity działały w przeglądarce | tylko do podglądu; nie kopiować do `src/` |
| `ui_kits/public-web/` | Profil, strona realizacji, hero, 404 — `index.html` z panelem Tweaks (widz, szerokość, język, tło, avatar, panel) | ekrany publiczne |
| `ui_kits/app/` | Login, rejestracja, 2FA, onboarding, edytor profilu (zastąpiony panelem), ustawienia konta | ekrany zalogowane |
| `ui_kits/*/shots.html` | Deterministyczne sceny do zrzutów (`window.__shot({...})`) | Playwright |
| `guidelines/*.card.html` | Karty design systemu: marka, plakietka, kolory, typografia, spacing, promienie, cienie, ruch, stany, głos | kontekst |
| `assets/` | Zdjęcia demo (XOSA, fasada, placeholder) | seed / zrzuty; nie do produkcji |
| `readme.md` | Fundamenty treści i wizualne (zasady copy, paleta, ruch, ikony) | wszyscy |
| `docs/claude-code-prompt-195.md` | Kierunek z 13.09 | czytać przed kodem |
| `docs/handoff/00-decyzje-2026-09-14.md` | **Nadpisania z 14.09 — wygrywa z powyższym** | czytać przed kodem |
| `docs/handoff/prompt-*.md` | Prompty dla Claude Code, po kolei | Dawid → Claude Code |
| `docs/handoff/shots/` | `matrix.json` (44 stany), `capture.mjs.txt` (Playwright; po wrzuceniu do repo zmień nazwę na `capture.mjs` — `.txt`, bo kompilator kitu próbował go zbundlować), `out/` (zrzuty po uruchomieniu) | referencje wizualne + baseline testów |
| `docs/ui-specification.md` | Kopia spec #185 — w repo jest oryginał; tę wersję **pomiń** | — |

Można pominąć: `uploads/` (surowe pliki), `_ds_manifest.json`, `_adherence.oxlintrc.json`, `thumbnail.html`, `SKILL.md`, `github.md`.

## Jak oglądać kity

Statyczny serwer w `design/` (Babel standalone nie wczyta `.jsx` z `file://`):

```
npx serve design -l 4173
# → http://localhost:4173/ui_kits/public-web/index.html
# → http://localhost:4173/ui_kits/app/index.html
```

Panel Tweaks (prawy dolny róg) przełącza widza, szerokość, język, tło, avatar, panel. Dolny switcher przełącza ekran.

## Jak zrobić zrzuty referencyjne

```
mv design/docs/handoff/shots/capture.mjs.txt design/docs/handoff/shots/capture.mjs
pnpm exec playwright install chromium   # jeśli brak
node design/docs/handoff/shots/capture.mjs
```

Wynik: `design/docs/handoff/shots/out/<id>.png` — 44 plików, desktop 1440×900 i telefon 390×844, `deviceScaleFactor 2`. Te same `id` są baseline’em dla testów wizualnych (krok 3).

## Zasada nadrzędna

Kity to **referencja wyglądu i zachowania**, nie kod do przeklejenia. Odtwarzasz je w stacku produktu (Next.js, Tailwind v4 przez arbitrary values na tych samych zmiennych CSS, next-intl), zachowując identyfikatory elementów ze `docs/ui-specification.md`, o ile decyzje 13–14.09 ich nie zmieniły.

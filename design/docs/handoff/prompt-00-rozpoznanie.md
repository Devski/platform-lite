# Prompt 00 dla Claude Code — rozpoznanie, zero zmian w kodzie

**Tryb i budżet:** ultrathink. Tylko czytanie i jeden dokument na wyjściu. Nie edytuj żadnego pliku poza `design/handoff/00-mapa-luk.md`.

---

Pracujesz w repozytorium `Devski/platform-lite` (Next.js, Tailwind v4, next-intl, Playwright). W katalogu `design/` leży design system Architektów 3d wyeksportowany 14.09.2026 — HTML/JSX z inline’owymi stylami, w którym każdy wymiar jest zapisany wprost. **To referencja, nie kod do wklejenia.** Twoim zadaniem w tym kroku jest wyłącznie zrozumieć, co w produkcie odbiega od referencji, i spisać to.

## Czytaj w tej kolejności

1. `design/docs/claude-code-prompt-195.md` — kierunek zatwierdzony 13.09.
2. `design/docs/handoff/00-decyzje-2026-09-14.md` — **nadpisania z 14.09; ten plik wygrywa** z poprzednim.
3. `design/readme.md`, `design/styles.css` i `design/tokens/*.css` — wartości.
4. `design/components/core/Avatar.jsx`, `Plaque.jsx`; `design/components/profile/ProfileBar.jsx`, `AboutPanel.jsx`, `WorkCard.jsx`, `OrbitTile.jsx` + ich `.d.ts` i `.prompt.md`.
5. `design/ui_kits/public-web/PublicProfile.jsx`, `WorkPage.jsx`, `Hero.jsx`, `NotFound.jsx`, `data.js`, `index.html`; `design/ui_kits/app/*`.
6. `docs/ui-specification.md` (w repo) — stan produktu przed zmianą; identyfikatory elementów `V-*`, `C-*`, `D-*`, `F-*`.
7. Kod produktu: `src/app/globals.css`, `src/components/ui/*`, `src/app/[locale]/(public)/**`, `(app)/**`, `(auth)/**`, `messages/pl.json`, `messages/en.json`, `e2e/**`.

## Wyjście: `design/handoff/00-mapa-luk.md`

Po polsku. Sekcje:

1. **Tokeny** — tabela `nazwa | wartość w design/tokens | wartość w globals.css | różnica`. Każdy token, bez wyjątku (jest ich ok. 158). Brakujące oznacz „brak”.
2. **Komponenty** — dla każdego z: Avatar, Plaque, Button, Input, Icon, LanguageChip, AccountMenu/Popover, ProfileBar, AboutPanel (tryb read-only i edit), WorkCard (3 układy), OrbitTile, Footer, Lightbox: `plik referencji | odpowiednik w src | co jest do zrobienia (nowy / przebudowa / re-skin) | ryzyka`. Wymiary cytuj z pliku referencji z numerem linii.
3. **Ekrany** — profil (3 widzów × desktop/telefon × panel zamknięty/otwarty/edycja), strona realizacji (read-only / edycja / nowa), hero, 404, auth, onboarding, ustawienia: `route | stan dziś | docelowo | migracje danych` (`works.slug`, `works.card_layout`, `works.r360_autorotate`, `works.description`, `profiles.avatar_shape`).
4. **Słowniki** — lista kluczy do dodania/zmiany/usunięcia w `pl.json` i `en.json`, z tekstami wziętymi **dosłownie** z referencji (`T` w `PublicProfile.jsx`, `t` w `AboutPanel.jsx`, `WT` w `WorkPage.jsx`).
5. **Testy e2e** — które selektory się posypią (np. „Edytuj profil” jest teraz `aria-label` ołówka w pasku, „Zapisz” to ✓ z `aria-label`).
6. **Sprzeczności** — miejsca, gdzie referencja, prompt-195, decyzje 14.09 i spec mówią co innego. Nie rozstrzygaj; wypisz z odwołaniami. Dawid rozstrzygnie przed promptem 01.
7. **Proponowany podział na PR-y** — potwierdź lub popraw kolejność: tokens → prymitywy → profil → realizacja + menu → re-skin reszty; przy każdym PR 3–6 małych promptów (jeden komponent lub jeden ekran na prompt).

Kryterium odbioru: dokument, po którym ktoś nieobecny w tej rozmowie wie, co zmienić, gdzie i w jakiej kolejności — bez otwierania kitu. Nie pisz kodu. Nie proponuj „ulepszeń” referencji.

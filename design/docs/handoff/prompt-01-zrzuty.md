# Prompt 01 dla Claude Code — zrzuty referencyjne z kitu

**Tryb i budżet:** normalny. Zadanie mechaniczne; myśl tylko przy usterkach.

---

W `design/` leży eksport design systemu (patrz `design/docs/handoff/README-eksport.md`). Zrób zrzuty referencyjne wszystkich stanów z `design/docs/handoff/shots/matrix.json` prawdziwym Chromium.

1. Zmień nazwę `design/docs/handoff/shots/capture.mjs.txt` → `capture.mjs`. Upewnij się, że Playwright ma chromium: `pnpm exec playwright install chromium`.
2. Uruchom `node design/docs/handoff/shots/capture.mjs`. Skrypt sam podnosi statyczny serwer na `design/`, otwiera `ui_kits/public-web/shots.html` i `ui_kits/app/shots.html`, dla każdego wpisu wywołuje `window.__shot(...)`, wykonuje `actions` i zapisuje `.stage` do `design/docs/handoff/shots/out/<id>.png`.
3. Jeśli któryś wpis się wywali (selektor nie trafia, timeout), **nie zmieniaj kitu** (`ui_kits/**`, `components/**`). Popraw wyłącznie selektor/`wait` w `matrix.json` albo `capture.mjs` i zapisz w `design/docs/handoff/01-zrzuty-raport.md`, co i dlaczego zmieniłeś.
4. Obejrzyj każdy zrzut (otwórz plik). W raporcie wypisz, gdzie widzisz coś, co wygląda na błąd kitu (np. ucięty tekst, element pod paskiem, brak ikony) — z nazwą pliku i opisem. **Nie naprawiaj**; to lista dla Dawida.
5. Commit: `design/docs/handoff/shots/out/*.png` + raport. Nic w `src/`.

Kryterium odbioru: 44 pliki PNG, każdy przedstawia stan z `id` (desktop 1440×900 lub telefon 390×844, @2x), raport z listą odchyleń lub zdaniem „bez uwag”.

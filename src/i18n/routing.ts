import { defineRouting } from "next-intl/routing";

// A8: Polish unprefixed (/handle), other locales prefixed (/en/...).
// Adding a language = a new entry here + a messages/<locale>.json dictionary.
export const routing = defineRouting({
  locales: ["pl", "en"],
  defaultLocale: "pl",
  localePrefix: "as-needed",
});

// The one shared alias for a supported locale — import it instead of
// re-deriving (typeof routing.locales)[number] in every consumer.
export type Locale = (typeof routing.locales)[number];

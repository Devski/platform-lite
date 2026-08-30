import { defineRouting } from "next-intl/routing";

// A8: Polish unprefixed (/handle), other locales prefixed (/en/...).
// Adding a language = a new entry here + a messages/<locale>.json dictionary.
export const routing = defineRouting({
  locales: ["pl", "en"],
  defaultLocale: "pl",
  localePrefix: "as-needed",
});

import { z } from "zod";

// A4: display name 1–80 characters. Shared by the settings form and the
// server edge, same single-source principle as auth-schemas.ts. Control and
// format characters are refused: NUL would 500 at Postgres, and invisible
// bidi/zero-width characters are a name-spoofing primitive once #18 renders
// names publicly (#14 audit).
export const DISPLAY_NAME_MAX = 80;

// The one rule for every single-line text field here. Control and format
// characters as in the #14 audit, plus the Unicode line and paragraph
// separators (Zl, Zp): browsers break a line at U+2028 too, and "one line"
// has to mean one line. The bio alone admits the newline itself.
const NO_CONTROL_OR_FORMAT = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]*$/u;
const NO_CONTROL_OR_FORMAT_BUT_NEWLINE =
  /^(?:[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]|\n)*$/u;

// Every field is composed (NFC) before it is measured or compared: "Łódź"
// typed on a Mac keyboard arrives decomposed, seven code points instead of
// five, and would otherwise pass as a second, different place.
export const displayNameSchema = z
  .string()
  .normalize("NFC")
  .trim()
  .min(1)
  .max(DISPLAY_NAME_MAX)
  .regex(NO_CONTROL_OR_FORMAT);

// #72 / A12: the profile sections. CRLF is folded to LF before the bio is
// measured, so the 1500 counts what the reader sees and what the database
// CHECK measures (schema.ts pins the same numbers).
export const HEADLINE_MAX = 220;
export const BIO_MAX = 1500;
export const LOCATIONS_MAX = 8;
export const LOCATION_MAX = 80;

/** Empty means "no headline" — the writer stores it as NULL. */
export const headlineSchema = z
  .string()
  .normalize("NFC")
  .trim()
  .max(HEADLINE_MAX)
  .regex(NO_CONTROL_OR_FORMAT);

/** Empty means "no bio". */
export const bioSchema = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n"))
  .pipe(
    z
      .string()
      .normalize("NFC")
      .trim()
      .max(BIO_MAX)
      .regex(NO_CONTROL_OR_FORMAT_BUT_NEWLINE),
  );

// A place is a label: a TERYT name the form suggested, or whatever the
// owner typed ("cała Polska", "Berlin"). Duplicates are refused ignoring
// case, since "Warszawa" and "warszawa" would render as one place twice.
export const locationSchema = z
  .string()
  .normalize("NFC")
  .trim()
  .min(1)
  .max(LOCATION_MAX)
  .regex(NO_CONTROL_OR_FORMAT);
export const locationsSchema = z
  .array(locationSchema)
  .max(LOCATIONS_MAX)
  .refine(
    (places) =>
      new Set(places.map((place) => place.toLocaleLowerCase("pl"))).size ===
      places.length,
    { message: "duplicate place" },
  );

/** What a sections write may carry — any subset; an absent key is untouched. */
export const profileSectionsSchema = z
  .object({
    headline: headlineSchema,
    locations: locationsSchema,
    bio: bioSchema,
  })
  .partial();
export type ProfileSectionsInput = z.input<typeof profileSectionsSchema>;

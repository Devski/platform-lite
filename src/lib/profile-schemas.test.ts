import { describe, expect, it } from "vitest";
import {
  BIO_MAX,
  HEADLINE_MAX,
  LOCATION_MAX,
  LOCATIONS_MAX,
  bioSchema,
  headlineSchema,
  locationsSchema,
  profileSectionsSchema,
} from "./profile-schemas";

// #72 / A12: the section schemas are the client's and the server's one
// definition of what fits (§5), so they are tested as values, not as forms.

describe("headlineSchema", () => {
  it("trims, allows empty, and caps at 220", () => {
    expect(headlineSchema.parse("  Wizualizacje dla deweloperów  ")).toBe(
      "Wizualizacje dla deweloperów",
    );
    expect(headlineSchema.parse("")).toBe("");
    expect(headlineSchema.safeParse("x".repeat(HEADLINE_MAX)).success).toBe(
      true,
    );
    expect(headlineSchema.safeParse("x".repeat(HEADLINE_MAX + 1)).success).toBe(
      false,
    );
  });

  it("refuses control and format characters, newlines included", () => {
    expect(headlineSchema.safeParse("jedna\nlinia").success).toBe(false);
    // Zero-width space (Cf) and a bell (Cc): the name-spoofing and the
    // Postgres-500 primitives the display name already refuses (#14).
    expect(headlineSchema.safeParse("a​b").success).toBe(false);
    expect(headlineSchema.safeParse("ab").success).toBe(false);
  });
});

describe("every single-line field", () => {
  it("refuses the Unicode line and paragraph separators, which browsers break at", () => {
    expect(headlineSchema.safeParse("a b").success).toBe(false);
    expect(headlineSchema.safeParse("a b").success).toBe(false);
    expect(locationsSchema.safeParse(["a b"]).success).toBe(false);
  });

  it("composes to NFC before measuring or comparing", () => {
    const decomposed = "Łódź".normalize("NFD");
    expect(decomposed).not.toBe("Łódź");
    expect(headlineSchema.parse(decomposed)).toBe("Łódź");
    // The same place twice, once decomposed: a duplicate, not two places.
    expect(locationsSchema.safeParse(["Łódź", decomposed]).success).toBe(false);
    // The limit counts the composed form.
    expect(
      headlineSchema.safeParse("é".normalize("NFD").repeat(HEADLINE_MAX))
        .success,
    ).toBe(true);
  });
});

describe("bioSchema", () => {
  it("keeps paragraphs, folds CRLF to LF, trims the ends, caps at 1500", () => {
    expect(bioSchema.parse("Pierwszy.\r\n\r\nDrugi.\r\n")).toBe(
      "Pierwszy.\n\nDrugi.",
    );
    expect(bioSchema.safeParse("x".repeat(BIO_MAX)).success).toBe(true);
    expect(bioSchema.safeParse("x".repeat(BIO_MAX + 1)).success).toBe(false);
    // The cap counts the folded text: 1500 characters plus CRs still fit.
    const crlf = "x".repeat(BIO_MAX - 2) + "\r\n";
    expect(bioSchema.safeParse(crlf).success).toBe(true);
  });

  it("refuses every other control or format character", () => {
    expect(bioSchema.safeParse("a\tb").success).toBe(false);
    // Right-to-left override (Cf).
    expect(bioSchema.safeParse("a‮b").success).toBe(false);
  });
});

describe("locationsSchema", () => {
  it("accepts up to 8 trimmed places of up to 80 characters", () => {
    expect(locationsSchema.parse([" Warszawa ", "mazowieckie"])).toEqual([
      "Warszawa",
      "mazowieckie",
    ]);
    expect(locationsSchema.parse([])).toEqual([]);
    expect(
      locationsSchema.safeParse(
        Array.from({ length: LOCATIONS_MAX }, (_, i) => `Miasto ${i}`),
      ).success,
    ).toBe(true);
    expect(
      locationsSchema.safeParse(
        Array.from({ length: LOCATIONS_MAX + 1 }, (_, i) => `Miasto ${i}`),
      ).success,
    ).toBe(false);
    expect(
      locationsSchema.safeParse(["x".repeat(LOCATION_MAX + 1)]).success,
    ).toBe(false);
  });

  it("refuses an empty place and a duplicate that differs only by case", () => {
    expect(locationsSchema.safeParse(["Warszawa", "  "]).success).toBe(false);
    expect(locationsSchema.safeParse(["Warszawa", "warszawa"]).success).toBe(
      false,
    );
    expect(locationsSchema.safeParse(["Łódź", "łódź"]).success).toBe(false);
  });
});

describe("profileSectionsSchema", () => {
  it("is a partial: an absent key stays absent, a present one is validated", () => {
    expect(profileSectionsSchema.parse({})).toEqual({});
    expect(profileSectionsSchema.parse({ headline: " x " })).toEqual({
      headline: "x",
    });
    expect(
      profileSectionsSchema.safeParse({ bio: "x".repeat(BIO_MAX + 1) }).success,
    ).toBe(false);
  });
});

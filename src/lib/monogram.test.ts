import { describe, expect, it } from "vitest";
import { initialsFrom, monogramImagePath } from "./monogram";

// The stand-in a profile without a photo shows, in the two places it appears
// (#27): the circle on the page and the generated share card.

describe("initialsFrom", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsFrom("Dawid Wróblewski")).toBe("DW");
    expect(initialsFrom("Studio Praga Architekci")).toBe("SP");
  });

  it("treats the separators a display name really contains", () => {
    expect(initialsFrom("Anna Kowalska-Nowak")).toBe("AK");
    expect(initialsFrom("studio.praga")).toBe("SP");
    expect(initialsFrom("render_lab")).toBe("RL");
    expect(initialsFrom("  wielokrotne   spacje ")).toBe("WS");
  });

  it("keeps Polish letters rather than folding them to ASCII", () => {
    // "Żaneta" rendered as Z would be a small insult repeated on every share,
    // and the card's font draws the diacritic correctly.
    expect(initialsFrom("Żaneta Świątek")).toBe("ŻŚ");
    expect(initialsFrom("Łukasz")).toBe("Ł");
  });

  it("skips what is not a letter instead of drawing it", () => {
    expect(initialsFrom("3D Studio")).toBe("DS");
    expect(initialsFrom("@nna")).toBe("N");
  });

  it("returns nothing when there is no letter at all", () => {
    // The caller draws the plain disc; a name of punctuation gets no monogram.
    expect(initialsFrom("...")).toBe("");
    expect(initialsFrom("")).toBe("");
  });

  it("gives one initial for a single word", () => {
    expect(initialsFrom("Kowalski")).toBe("K");
  });
});

describe("monogramImagePath", () => {
  it("addresses the card under the reserved /api prefix", () => {
    // A top-level /og would need a new reserved handle, and reserving one
    // after handles exist is a migration rather than a config line.
    expect(monogramImagePath("studio-praga")).toBe("/api/og/studio-praga");
  });
});

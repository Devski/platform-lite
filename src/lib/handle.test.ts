import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkHandle,
  handleBaseFrom,
  HANDLE_CHANGE_COOLDOWN_DAYS,
  HANDLE_MAX,
  HANDLE_MIN,
  HANDLE_PATTERN,
  handleSchema,
  nextHandleChangeAt,
  normalizeHandle,
  RESERVED_HANDLE_PREFIXES,
  RESERVED_HANDLES,
} from "./handle";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("HANDLE_PATTERN (A5)", () => {
  it("is exactly the SPEC A5 regex", () => {
    expect(HANDLE_PATTERN.source).toBe("^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$");
  });

  it.each(["abc", "a-b", "studio-praga", "x1y", "123", "a".repeat(30)])(
    "accepts %s",
    (handle) => {
      expect(HANDLE_PATTERN.test(handle)).toBe(true);
    },
  );

  it.each([
    ["ab", "too short"],
    ["a".repeat(31), "too long"],
    ["-abc", "leading hyphen"],
    ["abc-", "trailing hyphen"],
    ["Abc", "uppercase"],
    ["ab c", "space"],
    ["ab_c", "underscore"],
    ["żółć", "non-ascii"],
    ["", "empty"],
  ])("rejects %s (%s)", (handle) => {
    expect(HANDLE_PATTERN.test(handle)).toBe(false);
  });

  it("bounds match the exported constants", () => {
    expect(HANDLE_PATTERN.test("a".repeat(HANDLE_MIN))).toBe(true);
    expect(HANDLE_PATTERN.test("a".repeat(HANDLE_MIN - 1))).toBe(false);
    expect(HANDLE_PATTERN.test("a".repeat(HANDLE_MAX))).toBe(true);
    expect(HANDLE_PATTERN.test("a".repeat(HANDLE_MAX + 1))).toBe(false);
  });
});

describe("RESERVED_HANDLES (A5)", () => {
  it("contains every word SPEC A5 names", () => {
    for (const word of [
      "pl",
      "en",
      "api",
      "admin",
      "login",
      "settings",
      "assets",
    ]) {
      expect(RESERVED_HANDLES.has(word)).toBe(true);
    }
  });

  it("covers every route segment and metadata file under src/app, so no page can be shadowed", () => {
    // Walk the whole app tree: route groups "(x)" and dynamic segments "[x]"
    // are transparent, every other directory is an address segment, and
    // Next's metadata file conventions (icon, opengraph-image, …) resolve as
    // addresses too — with or without a numeric suffix and any extension.
    const appRoot = join(__dirname, "../app");
    const METADATA_FILE =
      /^(icon|apple-icon|opengraph-image|twitter-image|sitemap|robots|manifest)\d*\./;
    const segments = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (entry.name.startsWith("(") || entry.name.startsWith("[")) {
            walk(join(dir, entry.name));
          } else {
            segments.add(entry.name);
          }
        } else if (METADATA_FILE.test(entry.name)) {
          segments.add(entry.name.replace(/\d*\..*$/, ""));
        }
      }
    };
    walk(appRoot);
    expect(segments.size).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(RESERVED_HANDLES.has(segment)).toBe(true);
    }
  });

  it("names Next's metadata file conventions before any such file exists", () => {
    for (const word of [
      "icon",
      "apple-icon",
      "opengraph-image",
      "twitter-image",
    ]) {
      expect(RESERVED_HANDLES.has(word)).toBe(true);
    }
  });

  it("refuses any handle carrying the product or company name, but not the profession", () => {
    for (const handle of [
      "architektow3d-support",
      "admin-architektow3d",
      "architectorium-official",
      "the-architektorium",
      "architektow-3d-team",
    ]) {
      expect(checkHandle(handle)).toBe("reserved");
    }
    expect(checkHandle("architekt-kowalski")).toBeNull();
    expect(checkHandle("architektura-wnetrz")).toBeNull();
  });

  it("refuses the official-looking prefixes, but only the exact prefix with its hyphen", () => {
    for (const handle of [
      "admin-jan",
      "administrator-jan",
      "staff-jan",
      "official-studio",
      "support-team",
      "security-x",
      "root-y",
    ]) {
      expect(checkHandle(handle)).toBe("reserved");
    }
    // Ordinary words stay claimable as prefixes; the stem in any other
    // position, and look-alikes, are not chased.
    for (const handle of [
      "team-alfa",
      "mod-design",
      "administracja-x",
      "jan-admin",
      "supporter",
    ]) {
      expect(checkHandle(handle)).toBeNull();
    }
  });

  it("keeps the prefixes off the set: each carries its hyphen and its stem is reserved on its own", () => {
    for (const prefix of RESERVED_HANDLE_PREFIXES) {
      expect(prefix.endsWith("-")).toBe(true);
      expect(RESERVED_HANDLES.has(prefix)).toBe(false);
      expect(RESERVED_HANDLES.has(prefix.slice(0, -1))).toBe(true);
    }
  });

  it("holds lowercase values the pattern accepts, plus the short locale codes A5 names", () => {
    for (const word of RESERVED_HANDLES) {
      expect(word).toBe(word.toLowerCase());
      // Anything else the pattern already rejects would be dead weight; the
      // two-letter locale prefixes are listed because SPEC A5 names them.
      expect(HANDLE_PATTERN.test(word) || word.length < HANDLE_MIN).toBe(true);
    }
  });
});

describe("normalizeHandle + checkHandle + handleSchema", () => {
  it("normalizes case and whitespace at the edge", () => {
    expect(normalizeHandle("  Studio-Praga ")).toBe("studio-praga");
  });

  it("reports invalid before reserved, and null for a fine handle", () => {
    expect(checkHandle("studio-praga")).toBeNull();
    expect(checkHandle("Login")).toBe("invalid");
    expect(checkHandle("login")).toBe("reserved");
    expect(checkHandle("-x-")).toBe("invalid");
  });

  it("the schema normalizes, then carries the problem code as the message", () => {
    expect(handleSchema.parse(" Studio-Praga ")).toBe("studio-praga");
    const reserved = handleSchema.safeParse("Admin");
    expect(reserved.success).toBe(false);
    expect(reserved.error?.issues[0]?.message).toBe("reserved");
    const invalid = handleSchema.safeParse("a");
    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues[0]?.message).toBe("invalid");
  });
});

describe("nextHandleChangeAt (A6: once per 30 days)", () => {
  const now = new Date("2026-09-02T12:00:00Z");

  it("allows a change right away when there was none yet", () => {
    expect(nextHandleChangeAt(null, now)).toBeNull();
  });

  it("blocks within the window and names the exact release moment", () => {
    const changed = new Date(now.getTime() - 10 * DAY_MS);
    expect(nextHandleChangeAt(changed, now)).toEqual(
      new Date(changed.getTime() + HANDLE_CHANGE_COOLDOWN_DAYS * DAY_MS),
    );
  });

  it("releases exactly at 30 days, not a millisecond later", () => {
    const changed = new Date(
      now.getTime() - HANDLE_CHANGE_COOLDOWN_DAYS * DAY_MS,
    );
    expect(nextHandleChangeAt(changed, now)).toBeNull();
    const almost = new Date(changed.getTime() + 1);
    expect(nextHandleChangeAt(almost, now)).toEqual(
      new Date(now.getTime() + 1),
    );
  });
});

describe("handleBaseFrom (the onboarding proposal)", () => {
  it.each([
    ["Pracownia Żółć", "pracownia-zolc"],
    ["Jan Kowalski", "jan-kowalski"],
    ["jan.kowalski+tag", "jan-kowalski-tag"],
    ["  Łódź Studio  ", "lodz-studio"],
    ["Straße & Søn", "strasse-son"],
    ["--Studio--", "studio"],
    ["a".repeat(40), "a".repeat(HANDLE_MAX)],
    ["a".repeat(29) + "-b", "a".repeat(29)],
  ])("%s → %s", (text, expected) => {
    expect(handleBaseFrom(text)).toBe(expected);
  });

  it("returns null when nothing usable remains or the result is reserved", () => {
    expect(handleBaseFrom("ab")).toBeNull();
    expect(handleBaseFrom("!!!")).toBeNull();
    expect(handleBaseFrom("Admin")).toBeNull();
    expect(handleBaseFrom("żż")).toBeNull();
  });

  it("always yields a handle the pattern accepts", () => {
    for (const text of ["Ę ą ł", "x-y-z-", "1 2 3", "Studio 3D!!!"]) {
      const base = handleBaseFrom(text);
      if (base !== null) expect(HANDLE_PATTERN.test(base)).toBe(true);
    }
  });
});

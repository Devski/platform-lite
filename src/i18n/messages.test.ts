import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import pl from "../../messages/pl.json";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function leafValues(value: unknown): unknown[] {
  if (typeof value !== "object" || value === null) {
    return [value];
  }
  return Object.values(value).flatMap(leafValues);
}

describe("message dictionaries (A8)", () => {
  it("pl and en expose exactly the same key paths", () => {
    expect(keyPaths(pl).sort()).toEqual(keyPaths(en).sort());
  });

  it("every message is a non-empty string", () => {
    for (const dictionary of [pl, en]) {
      for (const value of leafValues(dictionary)) {
        expect(typeof value).toBe("string");
        expect(String(value).trim()).not.toBe("");
      }
    }
  });
});

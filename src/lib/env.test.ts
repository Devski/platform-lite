import { afterEach, describe, expect, it, vi } from "vitest";
import { appOrigin, isMissingEnv, requireEnv } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireEnv", () => {
  it("returns the trimmed value", () => {
    vi.stubEnv("PLATFORM_TEST_VAR", "  value  ");
    expect(requireEnv("PLATFORM_TEST_VAR")).toBe("value");
  });

  it("fails loud, naming the variable, when it is missing or blank", () => {
    vi.stubEnv("PLATFORM_TEST_VAR", "   ");
    expect(() => requireEnv("PLATFORM_TEST_VAR")).toThrow(
      "Missing required environment variable PLATFORM_TEST_VAR",
    );
    vi.stubEnv("PLATFORM_TEST_VAR", "");
    expect(() => requireEnv("PLATFORM_TEST_VAR")).toThrow(/PLATFORM_TEST_VAR/);
  });
});

// The callers that must survive a missing variable (src/proxy.ts, the public
// profile page) tell that case apart from an outage by this predicate only —
// so it has to recognize exactly what requireEnv throws, and nothing else.
describe("isMissingEnv", () => {
  function thrownFor(name: string): unknown {
    vi.stubEnv(name, "");
    try {
      requireEnv(name);
    } catch (error) {
      return error;
    }
    throw new Error("requireEnv did not throw");
  }

  it("recognizes what requireEnv throws for the variable it was asked about", () => {
    expect(
      isMissingEnv(thrownFor("PLATFORM_TEST_VAR"), "PLATFORM_TEST_VAR"),
    ).toBe(true);
  });

  it("refuses a DIFFERENT missing variable: a bucket is not a database (#18)", () => {
    expect(isMissingEnv(thrownFor("S3_SECRET"), "DATABASE_URL")).toBe(false);
  });

  it("does not mistake an outage — or a non-Error — for missing configuration", () => {
    expect(isMissingEnv(new Error("connection refused"), "DATABASE_URL")).toBe(
      false,
    );
    expect(
      isMissingEnv(
        "Missing required environment variable DATABASE_URL",
        "DATABASE_URL",
      ),
    ).toBe(false);
    expect(isMissingEnv(undefined, "DATABASE_URL")).toBe(false);
  });
});

describe("appOrigin (the prefix of every public address, #15)", () => {
  it("strips trailing slashes from APP_URL", () => {
    vi.stubEnv("APP_URL", "https://architektow3d.pl/");
    expect(appOrigin()).toBe("https://architektow3d.pl");
    vi.stubEnv("APP_URL", "http://localhost:3000//");
    expect(appOrigin()).toBe("http://localhost:3000");
  });

  it("leaves a bare origin alone", () => {
    vi.stubEnv("APP_URL", "https://architektow3d.pl");
    expect(appOrigin()).toBe("https://architektow3d.pl");
  });

  it("normalizes like the browser's Origin: host case, default port, path", () => {
    vi.stubEnv("APP_URL", "https://App.Example:443/x/");
    expect(appOrigin()).toBe("https://app.example");
  });

  it("throws on an unparsable value, like requireEnv on a missing one", () => {
    vi.stubEnv("APP_URL", "not a url");
    expect(() => appOrigin()).toThrow(/Invalid URL/);
  });
});

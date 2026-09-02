import { afterEach, describe, expect, it, vi } from "vitest";
import { appOrigin, requireEnv } from "./env";

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
});

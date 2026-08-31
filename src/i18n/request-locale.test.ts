import { describe, expect, it } from "vitest";
import { localeFromRequest } from "./request-locale";

// A8 precedence for paths the next-intl middleware does not see (/api/*):
// NEXT_LOCALE cookie → Accept-Language → default locale.

function request(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/auth/sign-up/email", {
    headers,
  });
}

describe("localeFromRequest (A8 precedence for API routes)", () => {
  it("returns the default locale when there is no request at all", () => {
    expect(localeFromRequest(undefined)).toBe("pl");
  });

  it("returns the default locale for a request without language signals", () => {
    expect(localeFromRequest(request({}))).toBe("pl");
  });

  it("prefers the NEXT_LOCALE cookie over Accept-Language", () => {
    expect(
      localeFromRequest(
        request({
          cookie: "theme=dark; NEXT_LOCALE=en; other=1",
          "accept-language": "pl,en;q=0.5",
        }),
      ),
    ).toBe("en");
  });

  it("ignores an unsupported NEXT_LOCALE cookie and falls through", () => {
    expect(
      localeFromRequest(
        request({ cookie: "NEXT_LOCALE=de", "accept-language": "en" }),
      ),
    ).toBe("en");
  });

  it("matches a regional Accept-Language variant to its base language", () => {
    expect(
      localeFromRequest(request({ "accept-language": "en-GB,en;q=0.9" })),
    ).toBe("en");
  });

  it("honours q-values instead of listing order", () => {
    expect(
      localeFromRequest(request({ "accept-language": "en;q=0.4,pl;q=0.8" })),
    ).toBe("pl");
  });

  it("skips unsupported languages and picks the best supported one", () => {
    expect(
      localeFromRequest(
        request({ "accept-language": "de-DE,de;q=0.9,en;q=0.5" }),
      ),
    ).toBe("en");
  });

  it("is case-insensitive about language tags", () => {
    expect(
      localeFromRequest(request({ "accept-language": "EN-gb" })),
    ).toBe("en");
  });

  it("falls back to the default locale on a malformed header", () => {
    expect(
      localeFromRequest(request({ "accept-language": ";;q=,,," })),
    ).toBe("pl");
  });

  it("treats q=0 as not acceptable (RFC 9110) instead of a candidate", () => {
    expect(
      localeFromRequest(request({ "accept-language": "en;q=0" })),
    ).toBe("pl");
  });
});

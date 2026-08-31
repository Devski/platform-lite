import { describe, expect, it } from "vitest";
import { PASSWORD_MAX, PASSWORD_MIN, signUpSchema } from "./auth-schemas";

// A1: 8-128 characters, no composition rules. One schema serves the client
// form and (through the exported bounds wired into createAuth) the server.

describe("signUpSchema (A1)", () => {
  it("pins the A1 password bounds", () => {
    expect(PASSWORD_MIN).toBe(8);
    expect(PASSWORD_MAX).toBe(128);
  });

  it("accepts a valid submission and normalizes the e-mail", () => {
    const parsed = signUpSchema.parse({
      email: "  MiXeD@Example.COM ",
      password: "12345678",
    });
    expect(parsed.email).toBe("mixed@example.com");
    expect(parsed.password).toBe("12345678");
  });

  it("never trims the password — spaces are legal password characters", () => {
    const parsed = signUpSchema.parse({
      email: "a@example.com",
      password: "  pad  ded  ",
    });
    expect(parsed.password).toBe("  pad  ded  ");
  });

  it("rejects a malformed e-mail", () => {
    const result = signUpSchema.safeParse({
      email: "not-an-email",
      password: "12345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords under 8 and over 128 characters, accepts the bounds", () => {
    const attempt = (password: string) =>
      signUpSchema.safeParse({ email: "a@example.com", password }).success;
    expect(attempt("1234567")).toBe(false);
    expect(attempt("12345678")).toBe(true);
    expect(attempt("x".repeat(128))).toBe(true);
    expect(attempt("x".repeat(129))).toBe(false);
  });

  it("names the failing field in issues, for dictionary-based form errors", () => {
    const result = signUpSchema.safeParse({ email: "bad", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("email");
      expect(paths).toContain("password");
    }
  });
});

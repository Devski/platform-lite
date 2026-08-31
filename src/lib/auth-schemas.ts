import { z } from "zod";

// A1: 8-128 characters, no composition rules. These constants are the single
// source of the bounds — the client form validates with the schema below and
// createAuth (src/lib/auth.ts) feeds the same numbers to Better Auth, so the
// server edge can never drift from the form (§5: same schemas on both sides).
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// Trim and lowercase before validating: what a form submits is exactly what
// the server stores (Better Auth normalizes the same way). Also used on its
// own where only an address is collected (e.g. resending the verification).
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const signUpSchema = z.object({
  email: emailSchema,
  // Never trim passwords — leading/trailing spaces are legal characters.
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
});

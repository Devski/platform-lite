import { z } from "zod";

// A1: 8-128 characters, no composition rules. These constants are the single
// source of the bounds — the client form validates with the schema below and
// createAuth (src/lib/auth.ts) feeds the same numbers to Better Auth, so the
// server edge can never drift from the form (§5: same schemas on both sides).
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const signUpSchema = z.object({
  // Trim and lowercase before validating: what the form submits is exactly
  // what the server stores (Better Auth normalizes the same way).
  email: z.string().trim().toLowerCase().pipe(z.email()),
  // Never trim passwords — leading/trailing spaces are legal characters.
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

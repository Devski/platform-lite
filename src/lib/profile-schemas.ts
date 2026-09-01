import { z } from "zod";

// A4: display name 1–80 characters. Shared by the settings form and the
// server edge, same single-source principle as auth-schemas.ts. Control and
// format characters are refused: NUL would 500 at Postgres, and invisible
// bidi/zero-width characters are a name-spoofing primitive once #18 renders
// names publicly (#14 audit).
export const DISPLAY_NAME_MAX = 80;
export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(DISPLAY_NAME_MAX)
  .regex(/^[^\p{Cc}\p{Cf}]+$/u);

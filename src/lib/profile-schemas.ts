import { z } from "zod";

// A4: display name 1–80 characters. Shared by the settings form and the
// server edge, same single-source principle as auth-schemas.ts.
export const DISPLAY_NAME_MAX = 80;
export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(DISPLAY_NAME_MAX);

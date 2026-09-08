import { z } from "zod";

// #72 / A12: a work (realizacja) as the form and the API agree on it. The
// same single-source principle as profile-schemas.ts; the database CHECKs
// carry the same 120s (schema.ts).
export const WORK_NAME_MAX = 120;
export const WORK_PARTY_MAX = 120;
export const WORK_PHOTOS_MAX = 3;
export const WORKS_MAX = 10;

const NO_CONTROL_OR_FORMAT = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]*$/u;

const partySchema = z
  .string()
  .normalize("NFC")
  .trim()
  .max(WORK_PARTY_MAX)
  .regex(NO_CONTROL_OR_FORMAT);

export const workInputSchema = z.object({
  name: z
    .string()
    .normalize("NFC")
    .trim()
    .min(1)
    .max(WORK_NAME_MAX)
    .regex(NO_CONTROL_OR_FORMAT),
  /** Empty means none — stored as NULL. */
  investor: partySchema.default(""),
  developer: partySchema.default(""),
  /**
   * The confirmed work-original file ids in display order: the first is the
   * MAIN photo (position 0). One to three, no repeats.
   */
  imageFileIds: z
    .array(z.uuid())
    .min(1)
    .max(WORK_PHOTOS_MAX)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "duplicate photo",
    }),
});
export type WorkInput = z.input<typeof workInputSchema>;

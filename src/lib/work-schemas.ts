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

export const workInputSchema = z
  .object({
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
    /**
     * #99: the second channel of each photo, by position — one entry per
     * photo, null where there is none. Absent means none at all.
     */
    secondaryFileIds: z.array(z.uuid().nullable()).optional(),
    /** The confirmed r360-zip file id, or none. */
    r360FileId: z.uuid().nullable().default(null),
  })
  .refine(
    (work) =>
      work.secondaryFileIds === undefined ||
      work.secondaryFileIds.length === work.imageFileIds.length,
    { message: "one second channel per photo", path: ["secondaryFileIds"] },
  )
  .refine(
    (work) => {
      const all = [
        ...work.imageFileIds,
        ...(work.secondaryFileIds ?? []).filter((id) => id !== null),
      ];
      return new Set(all).size === all.length;
    },
    { message: "duplicate photo", path: ["secondaryFileIds"] },
  );

/** The second channels of a parsed work, one per photo (null = none). */
export function secondariesOf(work: {
  imageFileIds: string[];
  secondaryFileIds?: (string | null)[];
}): (string | null)[] {
  return work.secondaryFileIds ?? work.imageFileIds.map(() => null);
}
export type WorkInput = z.input<typeof workInputSchema>;

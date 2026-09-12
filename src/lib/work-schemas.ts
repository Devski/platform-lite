import { z } from "zod";
import {
  R360_SET_ID_PATTERN,
  r360ParamsSchema,
} from "@/lib/r360/frame-set-shared";

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
     * MAIN photo (position 0). One to three, no repeats — or none at all
     * when the work carries an R360 set (#103, A12 as amended): its start
     * frame is the main picture then.
     */
    imageFileIds: z
      .array(z.uuid())
      .max(WORK_PHOTOS_MAX)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "duplicate photo",
      }),
    /**
     * #99: the second channel of each photo, by position — one entry per
     * photo, null where there is none. Absent means none at all.
     */
    secondaryFileIds: z
      .array(z.uuid().nullable())
      .max(WORK_PHOTOS_MAX)
      .optional(),
    /**
     * #102: the frame set the owner's browser produced from a zip on their
     * own machine, and the viewer's five parameters (#68) — both or
     * neither. A set already on the work is sent back unchanged; a new zip
     * brings a new set. Since #120 there is no archive to name beside it.
     */
    r360SetId: z.string().regex(R360_SET_ID_PATTERN).nullable().default(null),
    r360Params: r360ParamsSchema.nullable().default(null),
  })
  .refine((work) => (work.r360SetId === null) === (work.r360Params === null), {
    message: "a set with its parameters",
    path: ["r360Params"],
  })
  .refine((work) => work.imageFileIds.length > 0 || work.r360SetId !== null, {
    message: "a photo, or an R360 set",
    path: ["imageFileIds"],
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

/**
 * #66: the owner's order, as the ids of every work they have, first to last.
 * Whole rather than a pair of indices: the client already knows the list it
 * is looking at, and a request that names all of it can be checked against
 * what the database holds instead of trusted to be about the same list.
 */
export const worksOrderSchema = z
  .object({
    workIds: z
      .array(z.uuid())
      .min(1)
      .max(WORKS_MAX)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "duplicate work",
      }),
  })
  .strict();
export type WorksOrderInput = z.input<typeof worksOrderSchema>;

/** The second channels of a parsed work, one per photo (null = none). */
export function secondariesOf(work: {
  imageFileIds: string[];
  secondaryFileIds?: (string | null)[];
}): (string | null)[] {
  return work.secondaryFileIds ?? work.imageFileIds.map(() => null);
}
export type WorkInput = z.input<typeof workInputSchema>;

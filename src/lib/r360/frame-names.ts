// #101 (step 2 of #68, A13): which entries of an orbit archive are frames,
// and in what order — the contract users are given on #64, applied exactly
// as lenient as it reads, no more. Pure functions over names, so the same
// rule serves the browser before the upload and the server on save.

/** The count a viewer accepts: an orbit needs two frames; 360 is a degree each. */
export const R360_MIN_FRAMES = 2;
export const R360_MAX_FRAMES = 360;

/** What a browser can show. */
export const FRAME_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
/** What 3D software exports and a browser cannot show — refused by name. */
export const UNSHOWABLE_EXTENSIONS = ["exr", "tif", "tiff", "tga"] as const;

// The tuples above keep their literal types for callers; the lookups here
// want plain string sets.
const showable: ReadonlySet<string> = new Set(FRAME_EXTENSIONS);
const unshowable: ReadonlySet<string> = new Set(UNSHOWABLE_EXTENSIONS);

export type FrameRefusalReason =
  /** An entry in a render format no browser decodes; `files` names it. */
  | "unsupported_format"
  /** Nothing left after the junk is set aside. */
  | "no_frames"
  /** Fewer than R360_MIN_FRAMES; `count` says how many. */
  | "too_few"
  /** More than R360_MAX_FRAMES; `count` says how many. */
  | "too_many"
  /** Frames in more than one folder, or deeper than one; `files` names two. */
  | "folders"
  /** A frame with no digits in its name; `files` names it. */
  | "unnumbered"
  /** Neither run of digits orders the frames; `files` names the clash. */
  | "numbering";

export type FrameOrder<T extends { name: string }> =
  | { ok: true; frames: T[] }
  | { ok: false; reason: FrameRefusalReason; files: string[]; count: number };

/**
 * The frames of an archive, ordered by the number in their names: the last
 * run of digits before the extension, or the first run when the last does
 * not form a contiguous range from 0 or 1 without duplicates. Directory
 * records, `__MACOSX`, dot-files, `Thumbs.db` and files of any other type
 * are ignored; a single top-level folder is allowed.
 */
export function orderFrames<T extends { name: string }>(
  entries: readonly T[],
): FrameOrder<T> {
  const candidates: T[] = [];
  const refusedByFormat: string[] = [];
  for (const entry of entries) {
    if (isJunk(entry.name)) continue;
    const { extension } = partsOf(entry.name);
    if (showable.has(extension)) candidates.push(entry);
    else if (unshowable.has(extension) && refusedByFormat.length < 2) {
      // Two names are enough to say what went wrong, whatever the count.
      refusedByFormat.push(entry.name);
    }
  }
  const refuse = (
    reason: FrameRefusalReason,
    files: string[] = [],
  ): FrameOrder<T> => ({ ok: false, reason, files, count: candidates.length });

  if (refusedByFormat.length > 0) {
    return refuse("unsupported_format", refusedByFormat);
  }
  if (candidates.length === 0) return refuse("no_frames");
  if (candidates.length < R360_MIN_FRAMES) return refuse("too_few");
  if (candidates.length > R360_MAX_FRAMES) return refuse("too_many");

  const folderClash = folderClashOf(candidates);
  if (folderClash) return refuse("folders", folderClash);

  const digits = candidates.map((entry) => digitRuns(entry.name));
  const unnumbered = digits.findIndex((runs) => runs.length === 0);
  if (unnumbered !== -1) {
    return refuse("unnumbered", [candidates[unnumbered].name]);
  }
  const byLast = sequence(
    candidates,
    digits.map((runs) => runs[runs.length - 1]),
  );
  if (byLast.ok) return byLast;
  const byFirst = sequence(
    candidates,
    digits.map((runs) => runs[0]),
  );
  if (byFirst.ok) return byFirst;
  // The primary rule's clash is the one to explain: it is what #64 promises.
  return refuse("numbering", byLast.clash);
}

function isJunk(name: string): boolean {
  if (name.endsWith("/")) return true;
  const segments = name.split("/");
  return (
    segments.some(
      (segment) => segment === "__MACOSX" || segment.startsWith("."),
    ) || partsOf(name).base.toLowerCase() === "thumbs.db"
  );
}

interface NameParts {
  /** Up to and including the last slash; "" at the top level. */
  folder: string;
  /** The name after the last slash. */
  base: string;
  /** The base without its extension. */
  stem: string;
  /** Lower-case, without the dot; "" when there is none. */
  extension: string;
}

function partsOf(name: string): NameParts {
  const afterSlash = name.lastIndexOf("/") + 1;
  const folder = name.slice(0, afterSlash);
  const base = name.slice(afterSlash);
  const dot = base.lastIndexOf(".");
  if (dot === -1) return { folder, base, stem: base, extension: "" };
  return {
    folder,
    base,
    stem: base.slice(0, dot),
    extension: base.slice(dot + 1).toLowerCase(),
  };
}

/** Two frames that do not share the one allowed folder, or null. */
function folderClashOf(
  candidates: readonly { name: string }[],
): string[] | null {
  const first = partsOf(candidates[0].name).folder;
  // "" splits into one piece, "a/" into two, "a/b/" into three.
  const tooDeep = first.split("/").length > 2;
  const elsewhere = candidates.find(
    (candidate) => partsOf(candidate.name).folder !== first,
  );
  if (!tooDeep && !elsewhere) return null;
  return [candidates[0].name, (elsewhere ?? candidates[1]).name];
}

/**
 * The first and the last run of digits in the base name, extension
 * excluded — the two the rule uses; nothing in between is kept, so a
 * name that alternates digits and letters for kilobytes costs nothing.
 */
function digitRuns(name: string): string[] {
  const { stem } = partsOf(name);
  const first = /\d+/.exec(stem)?.[0];
  if (first === undefined) return [];
  const last = /(\d+)\D*$/.exec(stem)?.[1] ?? first;
  return [first, last];
}

type Sequence<T> = { ok: true; frames: T[] } | { ok: false; clash: string[] };

/**
 * The candidates ordered by their numbers when those form a contiguous
 * range from 0 or 1 without duplicates; otherwise the two files that break
 * it — the same number twice, or the two sides of a gap.
 */
function sequence<T extends { name: string }>(
  candidates: readonly T[],
  numbers: readonly string[],
): Sequence<T> {
  const ordered = candidates
    .map((entry, index) => ({ entry, number: Number(numbers[index]) }))
    .sort(
      (a, b) => a.number - b.number || a.entry.name.localeCompare(b.entry.name),
    );
  if (ordered[0].number > 1) {
    return { ok: false, clash: [ordered[0].entry.name] };
  }
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].number !== ordered[i - 1].number + 1) {
      return {
        ok: false,
        clash: [ordered[i - 1].entry.name, ordered[i].entry.name],
      };
    }
  }
  return { ok: true, frames: ordered.map((item) => item.entry) };
}

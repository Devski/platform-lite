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
  const unshowable: string[] = [];
  for (const entry of entries) {
    if (isJunk(entry.name)) continue;
    const extension = extensionOf(entry.name);
    if (includes(FRAME_EXTENSIONS, extension)) candidates.push(entry);
    else if (includes(UNSHOWABLE_EXTENSIONS, extension)) {
      unshowable.push(entry.name);
    }
  }
  const refuse = (
    reason: FrameRefusalReason,
    files: string[] = [],
  ): FrameOrder<T> => ({ ok: false, reason, files, count: candidates.length });

  if (unshowable.length > 0) return refuse("unsupported_format", unshowable);
  if (candidates.length === 0) return refuse("no_frames");
  if (candidates.length < R360_MIN_FRAMES) return refuse("too_few");
  if (candidates.length > R360_MAX_FRAMES) return refuse("too_many");

  const folderClash = folderClashOf(candidates);
  if (folderClash) return refuse("folders", folderClash);

  const runs = candidates.map((entry) => digitRuns(entry.name));
  const unnumbered = runs.findIndex((r) => r.length === 0);
  if (unnumbered !== -1) {
    return refuse("unnumbered", [candidates[unnumbered].name]);
  }
  const byLast = sequence(
    candidates,
    runs.map((r) => r[r.length - 1]),
  );
  if (byLast.ok) return byLast;
  const byFirst = sequence(
    candidates,
    runs.map((r) => r[0]),
  );
  if (byFirst.ok) return byFirst;
  // The primary rule's clash is the one to explain: it is what #64 promises.
  return refuse("numbering", byLast.clash);
}

function isJunk(name: string): boolean {
  if (name.endsWith("/")) return true;
  const segments = name.split("/");
  const base = segments[segments.length - 1];
  return (
    segments.some((s) => s === "__MACOSX" || s.startsWith(".")) ||
    base.toLowerCase() === "thumbs.db"
  );
}

function extensionOf(name: string): string {
  const base = name.slice(name.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

function includes(list: readonly string[], value: string): boolean {
  return list.includes(value);
}

/** Two frames that do not share the one allowed folder, or null. */
function folderClashOf(
  candidates: readonly { name: string }[],
): string[] | null {
  const folderOf = (name: string) => name.slice(0, name.lastIndexOf("/") + 1);
  const first = folderOf(candidates[0].name);
  const oneLevelAtMost =
    first === "" || first.indexOf("/") === first.length - 1;
  const elsewhere = candidates.find((c) => folderOf(c.name) !== first);
  if (oneLevelAtMost && !elsewhere) return null;
  return [candidates[0].name, (elsewhere ?? candidates[1]).name];
}

/** The runs of digits in the base name, extension excluded. */
function digitRuns(name: string): string[] {
  const base = name.slice(name.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  const stem = dot === -1 ? base : base.slice(0, dot);
  return stem.match(/\d+/g) ?? [];
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
  return { ok: true, frames: ordered.map((o) => o.entry) };
}

"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useMemo,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { OrbitRing } from "@/components/ui/orbit-ring";
import { OrbitViewer } from "@/components/ui/orbit-viewer";
import { UploadProgress } from "@/components/ui/upload-progress";
import { useFrameLoader } from "@/components/ui/use-frame-loader";
import { useOrbit } from "@/components/ui/use-orbit";
import { postJson } from "@/lib/api-client";
import { IMAGE_CONTENT_TYPES } from "@/lib/image-upload-shared";
import {
  browserFrameEncoder,
  canEncodeWebp,
} from "@/lib/r360/browser-frame-encoder";
import { orderFrames } from "@/lib/r360/frame-names";
import {
  produceFrameSet,
  type FrameSetOutcome,
} from "@/lib/r360/frame-pipeline";
import {
  FramePictures,
  pictureBytes,
  type FramePicture,
} from "@/lib/r360/frame-pictures";
import {
  defaultR360Params,
  frameUrls,
  R360_PREVIEW_WIDTH,
  type R360Params,
} from "@/lib/r360/frame-set-shared";
import {
  fileSource,
  openZip,
  ZipError,
  type ByteSource,
  type ZipArchive,
  type ZipEntry,
} from "@/lib/r360/zip-reader";
import {
  abandon,
  frameSetTransport,
  uploadImage,
  type UploadFailure,
} from "@/lib/upload-client";
import {
  WORK_NAME_MAX,
  WORK_PARTY_MAX,
  WORK_PHOTOS_MAX,
  WORKS_MAX,
  workInputSchema,
} from "@/lib/work-schemas";
import { R360ParamControls } from "./r360-params";
import type { GalleryWork } from "./works-gallery";

// #72 / A12: the card that unfolds under the "Realizacje" heading — a new
// work, or an existing one being edited. Name required; one to three
// photos, the first added being the main one until another is chosen;
// investor and developer optional. Photos upload as they are picked
// (lib/upload-client, purpose "work") and are named by id when the work is
// saved; a photo uploaded and then abandoned (cancel, or removed before
// saving) is discarded so it does not sit on the quota.

/**
 * #120: what the form knows about a work's orbit. The zip is READ on the
 * owner's machine and never sent, so there is no file to own here — only
 * the zip's name and size for the badge, the frames as they are produced,
 * and the staged set they land in.
 */
interface R360 {
  /** The zip's name; empty for a set the work already carries. */
  name: string;
  /** The zip's size on disk; 0 for a set already saved. */
  sizeBytes: number;
  /** The pipeline is running: frames are being made and sent. */
  working: boolean;
  /** #102/#103: the frames as they go — encoded, and landed in storage. */
  frames?: { done: number; total: number; landed: number };
  /**
   * #102: the set the work will name — produced now (with the staging
   * prefix to abandon if the form closes unsaved), or saved before.
   */
  set?: { id: string; params: R360Params; keyPrefix?: string };
}

/** The dictionary key for an archive the reader refused (#101). */
function zipRefusal(error: unknown): string {
  if (error instanceof ZipError) {
    switch (error.reason) {
      case "not_a_zip":
      case "encrypted":
      case "multi_part":
      case "unsupported_method":
      case "corrupt":
        return error.reason;
      case "http":
        // A signed address that ran out answers 403 (#105).
        return error.message.includes("403") ? "expired" : "network";
    }
  }
  return "network";
}

interface Slot {
  fileId: string;
  /** What the tile shows: the 480 px variant for a photo the work has or
   * the server has just confirmed, a local object URL while it uploads. */
  previewUrl: string;
  /** The local object URL of a photo picked in this form: the fallback if
   * the server's variant does not load. Revoked on unmount. */
  localUrl?: string;
  uploading: boolean;
  /** 0..1 while uploading; 1 while the server processes (#80). */
  progress?: number;
  /** Stops the transfer while the bytes are still moving. */
  abort?: AbortController;
  /** The preview did not decode (seen on a phone, #79): a neutral tile
   * instead of the browser's broken-image icon. */
  broken?: boolean;
  /** #99: the photo's second channel, uploaded like the photo itself. */
  secondary?: Channel;
}

interface Channel {
  fileId: string;
  previewUrl: string;
  uploading: boolean;
  progress?: number;
  abort?: AbortController;
}

// Best-effort: an orphan set is the quota's problem, not the owner's, and
// the route answers a file a work names with a no-op.
function discardFile(fileId: string): Promise<unknown> {
  return postJson("/api/uploads/discard", { fileId }).catch(() => undefined);
}

/** The public addresses of a saved set's preview-width frames (#103). */
function savedFrames(
  set: { params: R360Params; frameBase: string } | null,
): string[] {
  if (!set) return [];
  return frameUrls(set.frameBase, R360_PREVIEW_WIDTH, set.params.frameCount);
}

// "412 MB", "3,2 GB": enough precision for a badge, the decimal separator
// the page's locale uses.
function formatBytes(
  bytes: number,
  format: ReturnType<typeof useFormatter>,
): string {
  const units = ["B", "kB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value < 10 && unit > 0 ? 1 : 0;
  return `${format.number(value, { maximumFractionDigits: digits })} ${units[unit]}`;
}

/** `part / whole`, or 0 before there is a whole. */
function fractionOf(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

// #120: the frames ARE the progress now. There is no second transfer to
// weigh against them, so the bar is what it says: how many frames of the
// orbit are made and gone. The count only grows (#103 review), so the bar
// does too.
type FrameProgress = NonNullable<R360["frames"]>;
function framesFraction(frames: FrameProgress): number {
  return fractionOf(frames.done + frames.landed, 2 * frames.total);
}

type FormErrorKey =
  | "nameRequired"
  | "nameInvalid"
  | "partyInvalid"
  | "photoRequired"
  | "duplicatePhoto"
  | "uploading"
  | "limit"
  | "invalidImage"
  | "invalidArchive"
  | "invalidSet"
  | "framesExpired"
  | "rateLimited"
  | "generic";

/**
 * #85: what the page's own "Zapisz" asks of an open form. It waits for
 * the uploads in flight, then: a form nobody touched closes quietly, one
 * that saves is saved (onSaved fires as after its own button), and one
 * that cannot be saved is kept on screen with its reason — the page then
 * stays in editing rather than throwing the form away.
 */
export interface WorkFormHandle {
  settle(): Promise<"saved" | "closed" | "kept">;
}

export function WorkForm({
  work,
  onSaved,
  onCancel,
  ref,
}: {
  /** Absent for a new work. */
  work?: GalleryWork;
  onSaved: () => void;
  onCancel: () => void;
  ref?: Ref<WorkFormHandle>;
}) {
  const t = useTranslations("Works.form");
  const tUpload = useTranslations("Settings.profile.upload");
  const [name, setName] = useState(work?.name ?? "");
  const [investor, setInvestor] = useState(work?.investor ?? "");
  const [developer, setDeveloper] = useState(work?.developer ?? "");
  const [slots, setSlots] = useState<Slot[]>(() =>
    (work?.images ?? [])
      .filter(
        (image): image is typeof image & { fileId: string } => !!image.fileId,
      )
      .map((image) => ({
        fileId: image.fileId,
        previewUrl: image.url480,
        uploading: false,
        ...(image.secondary?.fileId
          ? {
              secondary: {
                fileId: image.secondary.fileId,
                previewUrl: image.secondary.url480,
                uploading: false,
              },
            }
          : {}),
      })),
  );
  // The tiles as they are right now, readable between renders: several
  // uploads finish in the same turn, and a decision (a duplicate, the cap,
  // what to restore) must see the tiles the previous one left, not the
  // last render's (#79 review). Every change goes through commitSlots.
  const slotsRef = useRef(slots);
  function commitSlots(next: (current: Slot[]) => Slot[]) {
    slotsRef.current = next(slotsRef.current);
    setSlots(slotsRef.current);
  }
  // #68/#120: the work's orbit — one per work, made here from a zip that
  // stays on the owner's disk.
  const [r360, setR360] = useState<R360 | null>(
    work?.orbit
      ? {
          name: "",
          sizeBytes: 0,
          working: false,
          set: { id: work.orbit.setId, params: work.orbit.params },
        }
      : null,
  );
  // The orbit as it is right now, readable between renders, like the
  // tiles: settle() decides after awaits (#85 review).
  const r360Ref = useRef(r360);
  function commitR360(
    next: R360 | null | ((current: R360 | null) => R360 | null),
  ) {
    r360Ref.current = typeof next === "function" ? next(r360Ref.current) : next;
    setR360(r360Ref.current);
  }
  // The frame run in flight, to stop it on remove or unmount, and the run
  // it belongs to: a callback from a run the owner has replaced writes
  // nothing (there is no file id to tell runs apart any more).
  const framesAbort = useRef<AbortController | null>(null);
  const run = useRef(0);

  // #117: the preview's frames as DECODED PICTURES, not addresses. A frame
  // the pipeline has just encoded is turned into a bitmap here and painted
  // straight onto the viewer's canvas, so the preview never fetches, never
  // decodes twice and holds no object URL that anything could revoke — the
  // failure Dawid hit on 09.09.2026, where every frame had an address and
  // none could be shown, has nowhere left to happen.
  const [localFrames, setLocalFrames] = useState<FramePictures | null>(null);
  const localFramesRef = useRef(localFrames);
  function commitLocalFrames(next: FramePictures | null) {
    localFramesRef.current?.clear();
    localEncodings.current = new Map();
    decodeWarned.current = false;
    localFramesRef.current = next;
    setLocalFrames(next);
  }
  // Which ordinals it holds, as an immutable snapshot: the store is
  // mutated in place, so a fresh set is what tells React it changed —
  // the same idiom the visitor's loader uses (use-frame-loader.ts).
  const [localLoaded, setLocalLoaded] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  // Every frame's encoding, kept beside the store: a long orbit spends its
  // budget and the store drops the far side, so a frame the owner turns
  // back to is decoded again from this rather than lost with no way back
  // (the archive is not read twice). Cheap — the browser backs a blob with
  // a file, not with pixels.
  const localEncodings = useRef(new Map<number, Blob>());
  const decodeWarned = useRef(false);
  // A set the work already carries is fetched like a visitor's (#104) —
  // the same queue, the same decode-before-it-counts, the same store.
  const savedUrls = useMemo(
    () => savedFrames(work?.orbit ?? null),
    [work?.orbit],
  );
  // A saved set is fetched like a visitor's (#104), and since #123 that
  // means the whole of it, coarse frames first — the owner who opens a
  // work to fix its name gets the same orbit a visitor gets, rather than
  // one that moves in jumps of eight until they take hold of it.
  const savedSet = useFrameLoader(
    savedUrls,
    work?.orbit?.params.startFrame ?? 1,
    { enabled: savedUrls.length > 0 && localFrames === null },
  );
  // The hand on the preview: the parameters as the owner has them so far,
  // or the defaults for the count while the set is still being produced.
  const previewParams =
    r360?.set?.params ??
    defaultR360Params(Math.max(2, r360?.frames?.total ?? 2));
  const previewOrbit = useOrbit(previewParams);
  // What the preview paints from, what the ring's arc fills with, and
  // what stands in until the first frame is there: the frames made here
  // while there are any, the saved set's otherwise. A run of frames made
  // here must not fall back on the set the new archive is replacing —
  // its start frame is another building.
  const preview = localFrames
    ? { pictures: localFrames, loaded: localLoaded, posterSrc: undefined }
    : {
        pictures: savedSet.pictures,
        loaded: savedSet.loaded,
        posterSrc: savedUrls[previewParams.startFrame - 1],
      };
  // The preview stands as soon as there are frames coming, so the owner
  // watches the first one arrive in the box rather than watching a box
  // appear late; until it does, the viewer says it is loading. It then
  // stands on the frames themselves: a finished pick carries its set and
  // no progress, so a gate on progress alone would hide the preview at the
  // moment there is most to look at (caught by e2e on #117).
  const previewShown =
    localFrames !== null || !!r360?.frames || savedUrls.length > 0;
  const format = useFormatter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Photos this form uploaded and has not saved onto the work: discarded if
  // the form closes without saving, or when the owner removes one.
  const unsaved = useRef(new Set<string>());
  const previews = useRef(new Set<string>());
  const ids = { name: useId(), investor: useId(), developer: useId() };
  const nameRef = useRef<HTMLInputElement>(null);

  // Set on unmount: a photo whose upload finishes after the form is gone is
  // discarded instead of joining a form that no longer exists.
  const closed = useRef(false);

  useEffect(() => {
    // Reset on every mount: React's development double-invoke runs the
    // cleanup below once before the real mount.
    closed.current = false;
    nameRef.current?.focus();
    const urls = previews.current;
    const orphans = unsaved.current;
    return () => {
      closed.current = true;
      framesAbort.current?.abort();
      // A set produced here and never saved stops counting now (#102).
      const staged = r360Ref.current?.set?.keyPrefix;
      if (staged) void abandon(staged);
      // Photos still on their way go with the form too (#80 review).
      for (const slot of slotsRef.current) {
        slot.abort?.abort();
        slot.secondary?.abort?.abort();
      }
      for (const url of urls) URL.revokeObjectURL(url);
      // #117: the decoded frames of a form that is really going away.
      // Nothing else frees them — a store still on screen is never
      // emptied from here, which is how the preview used to be left
      // pointing at addresses that had been revoked under it.
      localFramesRef.current?.clear();
      localFramesRef.current = null;
      // Whatever this form uploaded and did not save goes back off the
      // quota — however the form went away: cancel, another work's edit,
      // editing switched off, the work deleted under it.
      for (const fileId of orphans) void discardFile(fileId);
      orphans.clear();
    };
  }, []);

  function fail(key: FormErrorKey): false {
    setError(
      key === "limit"
        ? t(`errors.${key}`, { max: WORKS_MAX })
        : t(`errors.${key}`),
    );
    return false;
  }

  // Uploads in flight (photos, the archive), so the page's "Zapisz" can
  // wait for them instead of closing the form over them (#85).
  const inFlight = useRef(new Set<Promise<unknown>>());
  function track<T>(upload: Promise<T>): Promise<T> {
    inFlight.current.add(upload);
    void upload.finally(() => inFlight.current.delete(upload));
    return upload;
  }
  function uploadFail(failure: UploadFailure) {
    setError(tUpload(`errors.${failure}`));
  }

  // One picker for several files (#79), all of them or none (#93): a pick
  // of more than fit uploads nothing and says so — the owner chose a set,
  // and the form does not quietly take part of it.
  async function pickPhotos(files: File[], input: HTMLInputElement) {
    input.value = "";
    setError(null);
    const room = Math.max(0, WORK_PHOTOS_MAX - slotsRef.current.length);
    if (files.length > room) {
      setError(t("errors.tooManyPhotos", { offered: files.length, room }));
      return;
    }
    await Promise.all(files.map((file) => addPhoto(file)));
  }

  // The new photo takes the old tile's place, so a replaced main photo is
  // still the main one; the old photo comes back if the upload fails.
  async function replacePhoto(old: Slot, file: File, input: HTMLInputElement) {
    input.value = "";
    setError(null);
    await addPhoto(file, old);
  }

  async function addPhoto(file: File, replacing?: Slot) {
    const localUrl = URL.createObjectURL(file);
    previews.current.add(localUrl);
    const pendingId = `pending:${localUrl}`;
    const abort = new AbortController();
    const pending: Slot = {
      fileId: pendingId,
      previewUrl: localUrl,
      localUrl,
      uploading: true,
      progress: 0,
      abort,
      // A replaced photo keeps its second channel (#99): the channel is
      // the tile's, not the picture's.
      secondary: replacing?.secondary,
    };
    // The cap holds where the tiles change, not only in the picker's
    // arithmetic: a tile past the third is never made.
    if (!replacing && slotsRef.current.length >= WORK_PHOTOS_MAX) {
      previews.current.delete(localUrl);
      URL.revokeObjectURL(localUrl);
      return;
    }
    commitSlots((current) =>
      replacing
        ? current.map((slot) =>
            slot.fileId === replacing.fileId ? pending : slot,
          )
        : [...current, pending],
    );
    // Back to the photo as it was — with the channel as it is NOW, since
    // one may have landed on the tile while the replacement was in flight.
    const restore = (current: Slot[]) =>
      replacing
        ? current.map((slot) =>
            slot.fileId === pendingId
              ? { ...replacing, secondary: slot.secondary }
              : slot,
          )
        : current.filter((slot) => slot.fileId !== pendingId);

    const result = await uploadImage(file, "work", {
      signal: abort.signal,
      onProgress: (fraction) =>
        commitSlots((current) =>
          current.map((slot) =>
            slot.fileId === pendingId ? { ...slot, progress: fraction } : slot,
          ),
        ),
    });
    if (result.ok && closed.current) {
      // The form closed while this was uploading: nothing to attach it to.
      void discardFile(result.fileId);
      return;
    }
    if (!result.ok) {
      commitSlots(restore);
      if (result.failure !== "aborted") uploadFail(result.failure);
      return;
    }
    // Identical bytes confirm to the same file (the pipeline dedupes by
    // content), so a photo picked twice is one photo, not two tiles — and
    // replacing a photo with itself changes nothing. Either way the id was
    // on a tile already, so it is not this form's orphan to discard.
    const elsewhere = slotsRef.current.some(
      (slot) => slot.fileId === result.fileId && slot.fileId !== pendingId,
    );
    if (elsewhere || replacing?.fileId === result.fileId) {
      commitSlots(restore);
      if (elsewhere) fail("duplicatePhoto");
      return;
    }
    commitSlots((current) =>
      current.map((slot) =>
        slot.fileId === pendingId
          ? {
              ...slot,
              fileId: result.fileId,
              // The variant the card shows, from now on: it is what the
              // visitor will see, and it loads where a local preview may not.
              previewUrl: result.thumbnailUrl ?? slot.previewUrl,
              uploading: false,
              progress: undefined,
              abort: undefined,
              broken: false,
            }
          : slot,
      ),
    );
    if (replacing) void discard(replacing.fileId);
    unsaved.current.add(result.fileId);
  }

  // The preview did not decode: the local file if there is one and it is
  // not what just failed, else a neutral tile.
  // #99: the second channel of a photo — one file, the same chain, kept
  // on the tile it was picked for (the tile's id, so a replaced photo keeps
  // its channel only while the tile stays).
  async function pickChannel(slot: Slot, file: File, input: HTMLInputElement) {
    input.value = "";
    setError(null);
    const localUrl = URL.createObjectURL(file);
    previews.current.add(localUrl);
    const pendingId = `pending:${localUrl}`;
    const abort = new AbortController();
    const patch = (tileId: string, next: Channel | undefined) =>
      commitSlots((current) =>
        current.map((s) =>
          s.fileId === tileId ? { ...s, secondary: next } : s,
        ),
      );
    // A channel still on its way is stopped, not overwritten under itself.
    let previous = slot.secondary;
    if (previous?.uploading) {
      previous.abort?.abort();
      previous = undefined;
    }
    patch(slot.fileId, {
      fileId: pendingId,
      previewUrl: localUrl,
      uploading: true,
      progress: 0,
      abort,
    });
    const result = await uploadImage(file, "work", {
      signal: abort.signal,
      onProgress: (fraction) =>
        commitSlots((current) =>
          current.map((s) =>
            s.secondary?.fileId === pendingId
              ? { ...s, secondary: { ...s.secondary, progress: fraction } }
              : s,
          ),
        ),
    });
    const tile = slotsRef.current.find(
      (s) => s.secondary?.fileId === pendingId,
    );
    // The form closed, or the tile went (removed, replaced) while this was
    // uploading: nothing to attach it to.
    if (!tile || closed.current) {
      if (result.ok) void discardFile(result.fileId);
      return;
    }
    if (!result.ok) {
      patch(tile.fileId, previous);
      if (result.failure !== "aborted") uploadFail(result.failure);
      return;
    }
    // The same bytes as the photo itself, or as another tile's channel:
    // not a channel.
    const taken = slotsRef.current.some(
      (s) =>
        s.fileId === result.fileId ||
        (s.secondary?.fileId === result.fileId && s.fileId !== tile.fileId),
    );
    if (taken) {
      patch(tile.fileId, previous);
      fail("duplicatePhoto");
      return;
    }
    patch(tile.fileId, {
      fileId: result.fileId,
      previewUrl: result.thumbnailUrl ?? localUrl,
      uploading: false,
    });
    // The same bytes as the channel already there: nothing changed, and
    // nothing new is this form's orphan.
    if (previous?.fileId === result.fileId) return;
    if (previous) void discard(previous.fileId);
    unsaved.current.add(result.fileId);
  }

  function removeChannel(slot: Slot) {
    const channel = slot.secondary;
    if (!channel) return;
    setError(null);
    if (channel.uploading) {
      channel.abort?.abort();
    } else {
      void discard(channel.fileId);
    }
    commitSlots((current) =>
      current.map((s) =>
        s.fileId === slot.fileId ? { ...s, secondary: undefined } : s,
      ),
    );
  }

  function markBroken(fileId: string) {
    commitSlots((current) =>
      current.map((slot) =>
        slot.fileId !== fileId
          ? slot
          : slot.localUrl && slot.previewUrl !== slot.localUrl
            ? { ...slot, previewUrl: slot.localUrl }
            : { ...slot, broken: true },
      ),
    );
  }

  async function discard(fileId: string) {
    if (!unsaved.current.has(fileId)) return;
    unsaved.current.delete(fileId);
    await discardFile(fileId);
  }

  /**
   * #102 (A13): the zip is read here, on the owner's own machine — the
   * frames named, ordered and counted, or the zip refused with the reason
   * told and nothing returned. Since #120 this is the ONLY thing that ever
   * opens it: the archive is not uploaded, so nothing else could.
   */
  async function readArchive(
    source: ByteSource,
  ): Promise<{ zip: ZipArchive; frames: ZipEntry[] } | null> {
    let zip: ZipArchive;
    try {
      zip = await openZip(source);
    } catch (error) {
      // The reason, for a developer on dev — a truncated file and a real
      // read fault read the same to the owner.
      if (error instanceof ZipError)
        console.warn("[r360] archive refused:", error.message);
      setError(t(`r360.refused.${zipRefusal(error)}`));
      return null;
    }
    const order = orderFrames(zip.entries);
    if (!order.ok) {
      setError(
        t(`r360.refused.${order.reason}`, {
          files: order.files.join(", "),
          count: order.count,
        }),
      );
      return null;
    }
    return { zip, frames: order.frames };
  }

  /**
   * #121: the frame as the pipeline decoded it, kept ready to paint. It
   * arrives before either WebP is encoded, so this is the earliest the
   * preview can show anything at all. The store it was made for is checked
   * again — a picture for a store nobody is showing (the orbit removed,
   * another pick) holds a bitmap until something closes it.
   */
  function showFrame(
    into: FramePictures | null,
    ordinal: number,
    picture: FramePicture,
  ): void {
    if (!into || closed.current || localFramesRef.current !== into) {
      picture.release?.();
      return;
    }
    into.put(ordinal, picture);
    setLocalLoaded(into.ordinals);
  }

  /**
   * #117: one encoded frame, decoded and kept ready to paint — the way
   * back for a frame the store evicted, out of the encoding the form kept.
   * The store it started for is checked again afterwards — a decode that
   * lands after the owner removed the orbit, or after another pick, belongs
   * to a store nobody is showing. A frame the browser cannot decode is left
   * out rather than shown broken; the viewer paints its nearest neighbour.
   */
  async function keepFrame(
    into: FramePictures | null,
    ordinal: number,
    encoded: Blob,
  ): Promise<void> {
    if (!into) return;
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(encoded);
    } catch {
      // Once per orbit: a set the browser cannot decode would otherwise
      // write a line per frame and still tell the owner nothing.
      if (!decodeWarned.current) {
        decodeWarned.current = true;
        console.warn("[r360] a frame could not be decoded for the preview");
      }
      return;
    }
    if (closed.current || localFramesRef.current !== into) {
      bitmap.close();
      return;
    }
    into.put(ordinal, {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      bytes: pictureBytes(bitmap.width, bitmap.height),
      release: () => bitmap.close(),
    });
    setLocalLoaded(into.ordinals);
  }

  // The frame in view was decoded once and then evicted to stay inside
  // the store's budget: decode it again from the encoding kept above, so
  // a long orbit turns fully instead of sticking on its far side.
  useEffect(() => {
    const store = localFramesRef.current;
    if (!store || store.has(previewOrbit.frame)) return;
    const encoded = localEncodings.current.get(previewOrbit.frame);
    if (encoded) void keepFrame(store, previewOrbit.frame, encoded);
  }, [previewOrbit.frame, localLoaded]);

  /**
   * Shows the zip in the form, its frames still to come, and produces and
   * uploads them (#102): the preview shows the very frames being uploaded
   * (#103) and the counters move per frame encoded or landed, not per
   * progress event of hundreds of PUTs — as long as this run is still the
   * one in the form. A browser whose canvas encodes no WebP takes no
   * reservation.
   */
  async function runFrames(
    zip: ZipArchive,
    frames: ZipEntry[],
    entry: Pick<R360, "name" | "sizeBytes">,
    signal: AbortSignal,
  ): Promise<FrameSetOutcome> {
    const mine = ++run.current;
    const live = () => !closed.current && run.current === mine;
    commitR360({
      ...entry,
      working: true,
      frames: { done: 0, total: frames.length, landed: 0 },
    });
    commitLocalFrames(new FramePictures(frames.length));
    setLocalLoaded(new Set());
    previewOrbit.setFrame(1);
    if (!(await canEncodeWebp())) {
      return { ok: false, failure: "webp_unsupported" };
    }
    let moved = -1;
    return produceFrameSet({
      archive: zip,
      frames,
      encoder: browserFrameEncoder(),
      transport: frameSetTransport,
      signal,
      onPicture: (ordinal, picture) => {
        // A picture for a run that is no longer the form's goes to
        // showFrame as a picture with no store: it frees it.
        showFrame(live() ? localFramesRef.current : null, ordinal, picture);
      },
      // Not painted — the picture above already was. Kept so a frame the
      // store evicts can be decoded again without going to the archive.
      onFrame: (ordinal, encoded) => {
        if (!live()) return;
        const store = localFramesRef.current;
        localEncodings.current.set(ordinal, encoded[R360_PREVIEW_WIDTH]);
        // #121 showed this frame before this encoding existed, and the
        // encode is the long part. A store that has already dropped it
        // means the effect below ran with nothing to recover it from:
        // say so now that there is something.
        if (store && !store.has(ordinal)) setLocalLoaded(store.ordinals);
      },
      onProgress: (p) => {
        const bucket = p.framesDone * 1000 + p.framesLanded;
        if (bucket === moved || !live()) return;
        moved = bucket;
        commitR360((current) =>
          current
            ? {
                ...current,
                frames: {
                  done: p.framesDone,
                  total: p.framesTotal,
                  landed: p.framesLanded,
                },
              }
            : current,
        );
      },
    });
  }

  /** #102: the set produced, as the work will name it. */
  function producedSet(set: FrameSetOutcome & { ok: true }): R360["set"] {
    return {
      id: set.setId,
      params: defaultR360Params(set.frameCount),
      keyPrefix: set.keyPrefix,
    };
  }

  /**
   * #120: the owner picks a zip and it stays where it is. It is opened
   * here, its frames are made here, and only the frames are sent. Nothing
   * to presign for the archive, nothing to confirm, nothing to sweep — and
   * no wait on a transfer of hundreds of megabytes before the work can be
   * saved.
   */
  async function pickArchive(file: File, input: HTMLInputElement) {
    input.value = "";
    setError(null);
    const read = await readArchive(fileSource(file));
    if (!read) return;
    const controller = new AbortController();
    framesAbort.current = controller;
    const set = await runFrames(
      read.zip,
      read.frames,
      { name: file.name, sizeBytes: file.size },
      controller.signal,
    );
    framesAbort.current = null;
    if (closed.current) {
      if (set.ok) void abandon(set.keyPrefix);
      return;
    }
    if (!set.ok) {
      // Nothing landed that the work could name: the form goes back to
      // offering the picker, with the reason on screen.
      commitR360(null);
      commitLocalFrames(null);
      if (set.failure !== "aborted") setError(t(`r360.failed.${set.failure}`));
      return;
    }
    commitR360({
      name: file.name,
      sizeBytes: file.size,
      working: false,
      set: producedSet(set),
    });
  }

  // A set produced here and not saved is abandoned, so its ceiling stops
  // counting against the quota now rather than in two hours (#102 review).
  function abandonUnsavedSet(current: R360 | null) {
    if (current?.set?.keyPrefix) void abandon(current.set.keyPrefix);
  }

  function removeArchive() {
    // Stops the frames in flight; the abort path abandons what was staged.
    framesAbort.current?.abort();
    run.current += 1;
    abandonUnsavedSet(r360Ref.current);
    commitR360(null);
    commitLocalFrames(null);
  }

  // #103: the owner's four parameters, on the set the work will name.
  function setParams(change: Partial<R360Params>) {
    commitR360((current) => {
      if (!current?.set) return current;
      const params = { ...current.set.params, ...change };
      return { ...current, set: { ...current.set, params } };
    });
  }

  function removePhoto(fileId: string) {
    setError(null);
    // The photo's channel goes with it.
    const channel = slotsRef.current.find(
      (s) => s.fileId === fileId,
    )?.secondary;
    if (channel?.uploading) channel.abort?.abort();
    else if (channel) void discard(channel.fileId);
    commitSlots((current) => current.filter((slot) => slot.fileId !== fileId));
    void discard(fileId);
  }

  function setMain(fileId: string) {
    commitSlots((current) => {
      const chosen = current.find((slot) => slot.fileId === fileId);
      if (!chosen) return current;
      return [chosen, ...current.filter((slot) => slot !== chosen)];
    });
  }

  // One save at a time: a second caller — the page's "Zapisz" pressed
  // while the form's own is in flight (#85 review) — joins the request
  // already running instead of posting the work again.
  const saveInFlight = useRef<Promise<boolean> | null>(null);
  function save(): Promise<boolean> {
    if (saveInFlight.current) return saveInFlight.current;
    const run = performSave().finally(() => {
      saveInFlight.current = null;
    });
    saveInFlight.current = run;
    return run;
  }

  async function performSave(): Promise<boolean> {
    setError(null);
    // The tiles and the orbit as they are now (settle() calls this after
    // awaits); the text fields are committed by the typing itself.
    const tiles = slotsRef.current;
    if (
      tiles.some((slot) => slot.uploading || slot.secondary?.uploading) ||
      r360Ref.current?.working
    ) {
      return fail("uploading");
    }
    const trimmedName = name.trim();
    if (!trimmedName) return fail("nameRequired");
    // A work with an R360 set needs no photo (A12): its start frame stands
    // for it (#104).
    const orbit = r360Ref.current;
    if (tiles.length === 0 && !orbit?.set) return fail("photoRequired");
    const parsed = workInputSchema.safeParse({
      name: trimmedName,
      investor,
      developer,
      imageFileIds: tiles.map((slot) => slot.fileId),
      ...(tiles.some((slot) => slot.secondary)
        ? {
            secondaryFileIds: tiles.map(
              (slot) => slot.secondary?.fileId ?? null,
            ),
          }
        : {}),
      r360SetId: orbit?.set?.id ?? null,
      r360Params: orbit?.set?.params ?? null,
    });
    if (!parsed.success) {
      const path = parsed.error.issues[0]?.path[0];
      return fail(
        path === "name"
          ? "nameInvalid"
          : path === "imageFileIds"
            ? "duplicatePhoto"
            : "partyInvalid",
      );
    }
    setSaving(true);
    try {
      const response = work
        ? await fetch(`/api/works/${work.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(parsed.data),
          }).then(async (res) => ({
            ok: res.ok,
            status: res.status,
            data: (await res.json().catch(() => ({}))) as { error?: string },
          }))
        : await postJson<{ error?: string }>("/api/works", parsed.data);
      if (!response.ok) {
        if (response.status === 429) return fail("rateLimited");
        if (response.data.error === "limit") return fail("limit");
        if (response.data.error === "invalid_image")
          return fail("invalidImage");
        if (response.data.error === "invalid_archive") {
          return fail("invalidArchive");
        }
        if (response.data.error === "set_expired") return fail("framesExpired");
        if (response.data.error === "quota_exceeded") {
          uploadFail("quota_exceeded");
          return false;
        }
        if (
          [
            "invalid_set",
            "incomplete_set",
            "frame_too_large",
            "not_webp",
          ].includes(response.data.error ?? "")
        ) {
          return fail("invalidSet");
        }
        return fail("generic");
      }
      // Saved: the photos and the set belong to the work now.
      unsaved.current.clear();
      commitR360((current) =>
        current?.set
          ? { ...current, set: { ...current.set, keyPrefix: undefined } }
          : current,
      );
      onSaved();
      return true;
    } catch {
      return fail("generic");
    } finally {
      setSaving(false);
    }
  }

  // Nothing to keep: a new form with nothing in it, or an edit form with
  // every field and file as the work has them.
  function untouched(): boolean {
    const ids = slotsRef.current
      .map((slot) => `${slot.fileId}+${slot.secondary?.fileId ?? ""}`)
      .join(",");
    const setId = r360Ref.current?.set?.id ?? null;
    const params = JSON.stringify(r360Ref.current?.set?.params ?? null);
    if (work && params !== JSON.stringify(work.orbit?.params ?? null)) {
      return false;
    }
    if (!work) {
      return (
        name.trim() === "" &&
        investor.trim() === "" &&
        developer.trim() === "" &&
        ids === "" &&
        setId === null
      );
    }
    return (
      name.trim() === work.name &&
      investor.trim() === (work.investor ?? "") &&
      developer.trim() === (work.developer ?? "") &&
      ids ===
        work.images
          .filter((image) => image.fileId)
          .map((image) => `${image.fileId}+${image.secondary?.fileId ?? ""}`)
          .join(",") &&
      setId === (work.orbit?.setId ?? null)
    );
  }

  // The latest render's save and untouched: settle() runs across awaits,
  // after which the tiles and the archive have moved on from its closure.
  const latest = useRef({ save, untouched });
  useLayoutEffect(() => {
    latest.current = { save, untouched };
  });
  useImperativeHandle(
    ref,
    () => ({
      async settle() {
        while (inFlight.current.size > 0) {
          await Promise.allSettled([...inFlight.current]);
        }
        // The form went away while this waited ("Anuluj", another work's
        // "Edytuj"): its unmount discarded its files; nothing to save.
        if (closed.current) return "closed";
        if (latest.current.untouched()) return "closed";
        const saved = await latest.current.save();
        if (saved || closed.current) return saved ? "saved" : "closed";
        nameRef.current
          ?.closest("form")
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        nameRef.current?.focus();
        return "kept";
      },
    }),
    [],
  );

  // The unmount cleanup discards what was uploaded and not saved.
  function cancel() {
    onCancel();
  }

  const busy =
    saving || slots.some((slot) => slot.uploading) || !!r360?.working;

  return (
    <Card
      as="form"
      padding="default"
      className="flex w-full flex-col gap-(--sp-6)"
      onSubmit={(event: React.FormEvent) => {
        event.preventDefault();
        if (!busy) void save();
      }}
    >
      <h3 className="type-h3 text-(--text-strong)">
        {work ? t("editTitle") : t("newTitle")}
      </h3>
      <div className="grid grid-cols-1 gap-(--sp-5) sm:grid-cols-2">
        <Field
          id={ids.name}
          label={t("name.label")}
          value={name}
          max={WORK_NAME_MAX}
          placeholder={t("name.placeholder")}
          onChange={setName}
          inputRef={nameRef}
          className="sm:col-span-2"
        />
        <Field
          id={ids.investor}
          label={t("investor.label")}
          optional={t("optional")}
          value={investor}
          max={WORK_PARTY_MAX}
          placeholder={t("investor.placeholder")}
          onChange={setInvestor}
        />
        <Field
          id={ids.developer}
          label={t("developer.label")}
          optional={t("optional")}
          value={developer}
          max={WORK_PARTY_MAX}
          placeholder={t("developer.placeholder")}
          onChange={setDeveloper}
        />
      </div>

      <div className="flex flex-col gap-(--sp-2)">
        <p className="flex items-baseline gap-(--sp-2) type-label text-(--text-body)">
          <span>
            {t("photos.label")}{" "}
            <span className="font-normal text-(--text-muted)">
              {"· "}
              {t("photos.rule")}
            </span>
          </span>
          <span className="ml-auto shrink-0 font-normal whitespace-nowrap tabular-nums text-(--text-muted)">
            {t("photos.count", { count: slots.length, max: WORK_PHOTOS_MAX })}
          </span>
        </p>
        <div className="grid grid-cols-2 gap-(--sp-3) sm:grid-cols-3">
          {slots.map((slot, index) => (
            <div key={slot.fileId} className="flex flex-col gap-(--sp-2)">
              {/* The picture, and only the picture (#95): its controls sit
                  below it on the card's own ground, where they can be seen
                  on any photograph. The upload bar is a state of the
                  picture and stays on it, on a dark strip. */}
              <div
                className={`relative aspect-[4/3] overflow-hidden rounded-sm border bg-(--surface-sunken) ${
                  index === 0
                    ? "border-2 border-(--action-solid)"
                    : "border-(--border-hairline)"
                }`}
              >
                {slot.broken ? (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center type-eyebrow text-(--text-muted)">
                    <Icon name="camera" size={20} />
                    {t("photos.noPreview")}
                  </span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={slot.previewUrl}
                    alt=""
                    className={`h-full w-full object-cover ${slot.uploading ? "opacity-50" : ""}`}
                    onError={() => markBroken(slot.fileId)}
                  />
                )}
                {slot.uploading && (
                  <UploadProgress
                    compact
                    label={t("photos.label")}
                    fraction={slot.progress ?? 0}
                    onCancel={() => slot.abort?.abort()}
                    className="absolute right-0 bottom-0 left-0 bg-n-950/80 px-2 py-1.5"
                  />
                )}
                {slot.secondary?.uploading && (
                  <UploadProgress
                    compact
                    label={t("photos.channel")}
                    fraction={slot.secondary.progress ?? 0}
                    onCancel={() => removeChannel(slot)}
                    className="absolute right-0 bottom-0 left-0 bg-n-950/80 px-2 py-1.5"
                  />
                )}
                {slot.secondary && !slot.secondary.uploading && (
                  <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-n-950/80 px-2 py-0.5 type-eyebrow text-white">
                    <Icon name="layers" size={12} />
                    {t("photos.channelBadge")}
                  </span>
                )}
              </div>
              {!slot.uploading && (
                <div className="flex flex-col gap-(--sp-2)">
                  {index === 0 ? (
                    <span className="inline-flex h-(--control-h) items-center justify-center rounded-sm bg-n-950 px-(--sp-3) type-eyebrow text-white">
                      {t("photos.main")}
                    </span>
                  ) : (
                    <Button
                      variant="quiet"
                      onClick={() => setMain(slot.fileId)}
                      className="w-full"
                    >
                      {t("photos.setMain")}
                    </Button>
                  )}
                  {/* Room for one more here: the second channel (#95 asks
                      for the row to hold four). */}
                  {/* Side by side where they fit, one under the other on a
                      narrow phone: no control shrinks below its word. */}
                  <div className="flex flex-wrap gap-(--sp-2)">
                    {/* Replace: a picker for one file that takes this tile's
                        place, so a replaced main photo stays main. */}
                    <label
                      className={buttonClassName(
                        "quiet",
                        "md",
                        "flex-1 cursor-pointer focus-within:shadow-[var(--ring-focus)]",
                      )}
                    >
                      {t("photos.replaceShort")}
                      <input
                        type="file"
                        aria-label={t("photos.replace")}
                        accept={IMAGE_CONTENT_TYPES.join(",")}
                        className="sr-only"
                        data-testid={`work-photo-replace-${index}`}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void track(replacePhoto(slot, file, event.target));
                          }
                        }}
                      />
                    </label>
                    <Button
                      variant="quiet"
                      onClick={() => removePhoto(slot.fileId)}
                      aria-label={t("photos.remove")}
                      className="flex-1"
                    >
                      {t("photos.removeShort")}
                    </Button>
                    {/* #99: the second channel — one file, added or taken
                        away; no label, the icon and its name say it. */}
                    {slot.secondary ? (
                      <Button
                        variant="quiet"
                        onClick={() => removeChannel(slot)}
                        aria-label={t("photos.channelRemove")}
                        title={t("photos.channelRemove")}
                        className="w-(--control-h) px-0"
                      >
                        <Icon name="layers" size={16} />
                      </Button>
                    ) : (
                      <label
                        title={t("photos.channelAdd")}
                        className={buttonClassName(
                          "quiet",
                          "md",
                          "w-(--control-h) cursor-pointer px-0 focus-within:shadow-[var(--ring-focus)]",
                        )}
                      >
                        <Icon name="layers" size={16} />
                        <input
                          type="file"
                          aria-label={t("photos.channelAdd")}
                          accept={IMAGE_CONTENT_TYPES.join(",")}
                          className="sr-only"
                          data-testid={`work-photo-channel-${index}`}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void track(pickChannel(slot, file, event.target));
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {slots.length < WORK_PHOTOS_MAX && (
            <label className="relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-(--border-strong) bg-(--surface-sunken) text-center type-sm text-(--text-muted) hover:border-(--action-solid) focus-within:shadow-[var(--ring-focus)]">
              <Icon name="plus" size={20} />
              {slots.length === 0 ? t("photos.add") : t("photos.addMore")}
              {slots.length === 0 && (
                <span className="absolute top-1.5 left-2 type-eyebrow text-(--text-muted)">
                  {t("photos.required")}
                </span>
              )}
              <input
                type="file"
                // The web cannot tell a phone's picker "at most N"; it can
                // only offer one or many. Many while two or more fit, one
                // for the last place — so at least that pick cannot overflow.
                multiple={WORK_PHOTOS_MAX - slots.length > 1}
                accept={IMAGE_CONTENT_TYPES.join(",")}
                className="sr-only"
                data-testid="work-photos"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length > 0) {
                    void track(pickPhotos(files, event.target));
                  }
                }}
              />
            </label>
          )}
        </div>
        <p className="type-sm text-(--text-muted)">
          {slots.length < WORK_PHOTOS_MAX
            ? t("photos.hint")
            : t("photos.full", { max: WORK_PHOTOS_MAX })}
        </p>
      </div>

      <div className="flex flex-col gap-(--sp-2)">
        <p className="type-label text-(--text-body)">
          {t("r360.label")}{" "}
          <span className="font-normal text-(--text-muted)">
            {"· "}
            {t("r360.rule")}
          </span>
        </p>
        {r360 ? (
          <div className="flex flex-wrap items-center gap-(--sp-4) rounded-sm border border-(--border-hairline) bg-(--surface-card) px-(--sp-5) py-(--sp-4)">
            {!r360.working && (
              <span
                className="inline-flex items-center rounded-full bg-(--state-success-bg) px-(--sp-3) py-(--sp-1) type-eyebrow text-(--state-success)"
                role="status"
              >
                {t("r360.ready")}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate font-mono type-sm text-(--text-body)">
              {r360.name || t("r360.attached")}
              {r360.sizeBytes > 0 && (
                <>
                  {" · "}
                  {formatBytes(r360.sizeBytes, format)}
                </>
              )}
              {r360.set && !r360.working ? (
                <span
                  className="font-sans text-(--text-muted)"
                  data-testid="work-r360-frames"
                >
                  {" · "}
                  {t("r360.framesDone", {
                    total: r360.set.params.frameCount,
                  })}
                </span>
              ) : null}
            </span>
            {r360.working && r360.frames ? (
              <div className="flex basis-full flex-col gap-(--sp-2)">
                {/* #120: two counters, both of frames, both of them the
                    owner's own machine at work — there is no second
                    transfer to weigh them against any more. */}
                <UploadProgress
                  label={t("r360.progressLabel")}
                  fraction={framesFraction(r360.frames)}
                  onCancel={removeArchive}
                />
                <ul
                  className="flex flex-wrap gap-x-(--sp-4) gap-y-(--sp-1) type-sm text-(--text-muted)"
                  data-testid="work-r360-stages"
                >
                  <li data-testid="work-r360-frames">
                    {t("r360.stageFrames", {
                      done: r360.frames.done,
                      total: r360.frames.total,
                    })}
                  </li>
                  <li>
                    {t("r360.stageUpload", {
                      landed: r360.frames.landed,
                      total: r360.frames.total,
                    })}
                  </li>
                </ul>
              </div>
            ) : (
              <Button variant="quiet" onClick={removeArchive} disabled={saving}>
                {t("r360.remove")}
              </Button>
            )}
          </div>
        ) : (
          <label className="relative flex cursor-pointer items-center gap-(--sp-4) rounded-sm border border-dashed border-(--border-strong) bg-(--surface-sunken) px-(--sp-5) py-(--sp-4) type-sm text-(--text-muted) hover:border-(--action-solid) focus-within:shadow-[var(--ring-focus)]">
            <Icon name="upload" size={20} className="text-(--text-muted)" />
            {t("r360.add")}
            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="sr-only"
              data-testid="work-r360"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void track(pickArchive(file, event.target));
              }}
            />
          </label>
        )}
        <p className="type-sm text-(--text-muted)">{t("r360.hint")}</p>
        {r360 && previewShown && (
          <div
            className="flex flex-col gap-(--sp-4)"
            data-testid="work-r360-preview"
          >
            {/* #103/#117: the preview from the frames themselves — the ones
                encoded here, decoded once and painted onto a canvas, or the
                saved set's, fetched the way a visitor's are. */}
            <OrbitViewer
              pictures={preview.pictures}
              poster={preview.posterSrc ? previewParams.startFrame : undefined}
              posterSrc={preview.posterSrc}
              posterLoading="eager"
              params={previewParams}
              orbit={previewOrbit}
              alt={t("r360.previewAlt")}
              label={t("r360.previewLabel")}
              className="aspect-[16/9] overflow-hidden rounded-sm border border-(--border-hairline) bg-(--surface-sunken)"
            />
            {/* #106: the ring dial, flattened as the owner sets it. */}
            <OrbitRing
              orbit={previewOrbit}
              params={previewParams}
              loaded={preview.loaded}
              flattening={previewParams.flattening}
              tone="light"
              className="mx-auto w-48"
            />
            <p className="type-sm text-(--text-muted)">
              {t("r360.previewHint")}
              {" · "}
              <span data-testid="work-r360-frame-count">
                {t("r360.paramFrameCount")}
                {": "}
                {previewParams.frameCount}
              </span>
            </p>
            {r360.set && (
              <R360ParamControls
                params={r360.set.params}
                frameInView={previewOrbit.frame}
                disabled={saving}
                onChange={setParams}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-(--sp-3)">
        <Button variant="solid" type="submit" disabled={busy}>
          {saving ? t("saving") : work ? t("saveChanges") : t("save")}
        </Button>
        <Button variant="quiet" onClick={cancel} disabled={saving}>
          {t("cancel")}
        </Button>
        {error && (
          <p className="basis-full type-sm text-(--state-danger)" role="alert">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}

function Field({
  id,
  label,
  optional,
  value,
  max,
  placeholder,
  onChange,
  inputRef,
  className = "",
}: {
  id: string;
  label: string;
  optional?: string;
  value: string;
  max: number;
  placeholder: string;
  onChange: (value: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  const t = useTranslations("Settings.profile.sections");
  return (
    <div className={`flex flex-col gap-(--sp-2) ${className}`}>
      <label htmlFor={id} className="type-label text-(--text-body)">
        {label}
        {optional && (
          <span className="font-normal text-(--text-muted)">
            {" "}
            {"· "}
            {optional}
          </span>
        )}
      </label>
      <Input
        ref={inputRef}
        id={id}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="flex justify-end">
        <span
          className={`type-sm tabular-nums ${
            value.length >= max * 0.9
              ? "text-(--state-warning)"
              : "text-(--text-muted)"
          }`}
        >
          {t("counter", { count: value.length, max })}
        </span>
      </div>
    </div>
  );
}

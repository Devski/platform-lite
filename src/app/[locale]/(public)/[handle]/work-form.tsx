"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { UploadProgress } from "@/components/ui/upload-progress";
import { postJson } from "@/lib/api-client";
import { IMAGE_CONTENT_TYPES } from "@/lib/image-upload-shared";
import {
  uploadArchive,
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
import type { GalleryWork } from "./works-gallery";

// #72 / A12: the card that unfolds under the "Realizacje" heading — a new
// work, or an existing one being edited. Name required; one to three
// photos, the first added being the main one until another is chosen;
// investor and developer optional. Photos upload as they are picked
// (lib/upload-client, purpose "work") and are named by id when the work is
// saved; a photo uploaded and then abandoned (cancel, or removed before
// saving) is discarded so it does not sit on the quota.

interface Archive {
  fileId: string;
  sizeBytes: number;
  name: string;
  uploading: boolean;
  /** 0..1 while uploading. */
  progress?: number;
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
}

// 36 px targets with a clear gap: two 24 px ones side by side in a tile's
// corner were too close for a thumb — Android Chrome answers an ambiguous
// tap with nothing (Dawid, 08.09.2026).
const TILE_ACTION_CLASS =
  "flex h-9 w-9 touch-manipulation items-center justify-center rounded-full bg-(--n-950)/70 text-white hover:bg-(--n-950) focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)] focus-within:shadow-[var(--ring-focus)]";

// Best-effort: an orphan set is the quota's problem, not the owner's, and
// the route answers a file a work names with a no-op.
function discardFile(fileId: string): Promise<unknown> {
  return postJson("/api/uploads/discard", { fileId }).catch(() => undefined);
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
  // #72 step 5: the R360 archive — one per work, upload only.
  const [archive, setArchive] = useState<Archive | null>(
    work?.r360
      ? {
          fileId: work.r360.fileId,
          sizeBytes: work.r360.sizeBytes,
          name: "",
          uploading: false,
        }
      : null,
  );
  // The archive as it is right now, readable between renders, like the
  // tiles: settle() decides after awaits (#85 review).
  const archiveRef = useRef(archive);
  function commitArchive(
    next: Archive | null | ((current: Archive | null) => Archive | null),
  ) {
    archiveRef.current =
      typeof next === "function" ? next(archiveRef.current) : next;
    setArchive(archiveRef.current);
  }
  // The archive transfer in flight, to stop it on remove or unmount.
  const archiveAbort = useRef<AbortController | null>(null);
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
      archiveAbort.current?.abort();
      for (const url of urls) URL.revokeObjectURL(url);
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
    const restore = (current: Slot[]) =>
      replacing
        ? current.map((slot) => (slot.fileId === pendingId ? replacing : slot))
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

  async function pickArchive(file: File, input: HTMLInputElement) {
    input.value = "";
    setError(null);
    const pendingId = `pending:${file.name}:${file.size}`;
    commitArchive({
      fileId: pendingId,
      sizeBytes: file.size,
      name: file.name,
      uploading: true,
      progress: 0,
    });
    const controller = new AbortController();
    archiveAbort.current = controller;
    const result = await uploadArchive(file, {
      signal: controller.signal,
      onProgress: (fraction) =>
        commitArchive((current) =>
          current?.fileId === pendingId
            ? { ...current, progress: fraction }
            : current,
        ),
    });
    archiveAbort.current = null;
    if (result.ok && closed.current) {
      void discardFile(result.fileId);
      return;
    }
    if (!result.ok) {
      commitArchive((current) =>
        current?.fileId === pendingId ? null : current,
      );
      if (result.failure !== "aborted") uploadFail(result.failure);
      return;
    }
    unsaved.current.add(result.fileId);
    commitArchive({
      fileId: result.fileId,
      sizeBytes: result.sizeBytes,
      name: file.name,
      uploading: false,
    });
  }

  function removeArchive() {
    if (archive?.uploading) {
      // Stops the transfer; the abort path abandons the staged bytes.
      archiveAbort.current?.abort();
      commitArchive(null);
      return;
    }
    if (archive) void discard(archive.fileId);
    commitArchive(null);
  }

  function removePhoto(fileId: string) {
    setError(null);
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
    // The tiles and the archive as they are now (settle() calls this
    // after awaits); the text fields are committed by the typing itself.
    const tiles = slotsRef.current;
    const zip = archiveRef.current;
    if (tiles.some((slot) => slot.uploading) || zip?.uploading) {
      return fail("uploading");
    }
    const trimmedName = name.trim();
    if (!trimmedName) return fail("nameRequired");
    if (tiles.length === 0) return fail("photoRequired");
    const parsed = workInputSchema.safeParse({
      name: trimmedName,
      investor,
      developer,
      imageFileIds: tiles.map((slot) => slot.fileId),
      r360FileId: zip?.fileId ?? null,
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
        return fail("generic");
      }
      // Saved: the photos belong to the work now.
      unsaved.current.clear();
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
    const ids = slotsRef.current.map((slot) => slot.fileId).join(",");
    const archiveId = archiveRef.current?.fileId ?? null;
    if (!work) {
      return (
        name.trim() === "" &&
        investor.trim() === "" &&
        developer.trim() === "" &&
        ids === "" &&
        archiveId === null
      );
    }
    return (
      name.trim() === work.name &&
      investor.trim() === (work.investor ?? "") &&
      developer.trim() === (work.developer ?? "") &&
      ids ===
        work.images
          .filter((image) => image.fileId)
          .map((image) => image.fileId)
          .join(",") &&
      archiveId === (work.r360?.fileId ?? null)
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
    saving || slots.some((slot) => slot.uploading) || !!archive?.uploading;

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
            <div
              key={slot.fileId}
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
              {index === 0 ? (
                <span className="absolute top-1.5 left-1.5 rounded-full bg-(--n-950) px-2 py-0.5 type-eyebrow text-white">
                  {t("photos.main")}
                </span>
              ) : (
                !slot.uploading && (
                  <button
                    type="button"
                    onClick={() => setMain(slot.fileId)}
                    className="absolute right-1.5 bottom-1.5 left-1.5 h-7 rounded-sm bg-white/90 type-eyebrow text-(--text-strong) hover:bg-white focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
                  >
                    {t("photos.setMain")}
                  </button>
                )
              )}
              {slot.uploading ? (
                <UploadProgress
                  compact
                  fraction={slot.progress ?? 0}
                  onCancel={() => slot.abort?.abort()}
                  className="absolute right-1.5 bottom-1.5 left-1.5 rounded-sm bg-(--n-950)/70 px-2 py-1"
                />
              ) : (
                <span className="absolute top-1 right-1 flex gap-2">
                  {/* Replace: a picker for one file that takes this tile's
                      place, so a replaced main photo stays main. */}
                  <label
                    title={t("photos.replace")}
                    className={`${TILE_ACTION_CLASS} cursor-pointer`}
                  >
                    <Icon name="upload" size={16} />
                    <span className="sr-only">{t("photos.replace")}</span>
                    <input
                      type="file"
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
                  <button
                    type="button"
                    onClick={() => removePhoto(slot.fileId)}
                    aria-label={t("photos.remove")}
                    title={t("photos.remove")}
                    className={TILE_ACTION_CLASS}
                  >
                    <Icon name="x" size={16} />
                  </button>
                </span>
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
        {archive ? (
          <div className="flex flex-wrap items-center gap-(--sp-4) rounded-sm border border-(--border-hairline) bg-(--surface-card) px-(--sp-5) py-(--sp-4)">
            {!archive.uploading && (
              <span
                className="inline-flex items-center rounded-full bg-(--state-success-bg) px-(--sp-3) py-(--sp-1) type-eyebrow text-(--state-success)"
                role="status"
              >
                {t("r360.uploaded")}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate font-mono type-sm text-(--text-body)">
              {archive.name || t("r360.attached")}
              {" · "}
              {formatBytes(archive.sizeBytes, format)}
            </span>
            {archive.uploading ? (
              <UploadProgress
                fraction={archive.progress ?? 0}
                onCancel={removeArchive}
                className="basis-full sm:basis-auto sm:min-w-56"
              />
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

"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
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

interface Slot {
  fileId: string;
  /** What the tile shows: the 480 px variant for a photo the work has or
   * the server has just confirmed, a local object URL while it uploads. */
  previewUrl: string;
  uploading: boolean;
  /** The preview did not decode (seen on a phone, #79): a neutral tile
   * instead of the browser's broken-image icon. */
  broken?: boolean;
}

const TILE_ACTION_CLASS =
  "flex h-6 w-6 items-center justify-center rounded-full bg-(--n-950)/70 text-white hover:bg-(--n-950) focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)] focus-within:shadow-[var(--ring-focus)]";

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

export function WorkForm({
  work,
  onSaved,
  onCancel,
}: {
  /** Absent for a new work. */
  work?: GalleryWork;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Works.form");
  const tUpload = useTranslations("Settings.profile.upload");
  const [name, setName] = useState(work?.name ?? "");
  const [investor, setInvestor] = useState(work?.investor ?? "");
  const [developer, setDeveloper] = useState(work?.developer ?? "");
  const [slots, setSlots] = useState<Slot[]>(
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
  // #72 step 5: the R360 archive — one per work, upload only.
  const [archive, setArchive] = useState<{
    fileId: string;
    sizeBytes: number;
    name: string;
    uploading: boolean;
    /** 0..1 while uploading. */
    progress?: number;
  } | null>(
    work?.r360
      ? {
          fileId: work.r360.fileId,
          sizeBytes: work.r360.sizeBytes,
          name: "",
          uploading: false,
        }
      : null,
  );
  // The archive transfer in flight, to stop it on remove or unmount.
  const archiveAbort = useRef<AbortController | null>(null);
  const format = useFormatter();
  const [error, setError] = useState<string | null>(null);
  // Not an error: what happened to a pick that did not fit (#79).
  const [notice, setNotice] = useState<string | null>(null);
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

  function fail(key: FormErrorKey) {
    setError(
      key === "limit"
        ? t(`errors.${key}`, { max: WORKS_MAX })
        : t(`errors.${key}`),
    );
  }
  function uploadFail(failure: UploadFailure) {
    setError(tUpload(`errors.${failure}`));
  }

  // One picker for several files (#79): the first ones that fit go up in
  // parallel; the owner is told how many did not.
  async function pickPhotos(files: File[], input: HTMLInputElement) {
    input.value = "";
    setError(null);
    setNotice(null);
    const room = Math.max(0, WORK_PHOTOS_MAX - slots.length);
    const taken = files.slice(0, room);
    if (files.length > room) {
      setNotice(
        t("photos.overflow", {
          taken: taken.length,
          offered: files.length,
          max: WORK_PHOTOS_MAX,
        }),
      );
    }
    await Promise.all(taken.map((file) => addPhoto(file)));
  }

  // The new photo takes the old tile's place, so a replaced main photo is
  // still the main one; the old photo comes back if the upload fails.
  async function replacePhoto(old: Slot, file: File, input: HTMLInputElement) {
    input.value = "";
    setError(null);
    setNotice(null);
    await addPhoto(file, old);
  }

  async function addPhoto(file: File, replacing?: Slot) {
    const localUrl = URL.createObjectURL(file);
    previews.current.add(localUrl);
    const pendingId = `pending:${localUrl}`;
    const pending: Slot = {
      fileId: pendingId,
      previewUrl: localUrl,
      uploading: true,
    };
    setSlots((current) =>
      replacing
        ? current.map((slot) => (slot === replacing ? pending : slot))
        : [...current, pending],
    );
    const restore = (current: Slot[]) =>
      replacing
        ? current.map((slot) => (slot.fileId === pendingId ? replacing : slot))
        : current.filter((slot) => slot.fileId !== pendingId);

    const result = await uploadImage(file, "work");
    if (result.ok && closed.current) {
      // The form closed while this was uploading: nothing to attach it to.
      void discardFile(result.fileId);
      return;
    }
    if (!result.ok) {
      setSlots(restore);
      uploadFail(result.failure);
      return;
    }
    // Identical bytes confirm to the same file (the pipeline dedupes by
    // content), so a photo picked twice is one photo, not two tiles — and
    // replacing a photo with itself changes nothing.
    let duplicate = false;
    setSlots((current) => {
      const elsewhere = current.some(
        (slot) => slot.fileId === result.fileId && slot.fileId !== pendingId,
      );
      if (elsewhere || replacing?.fileId === result.fileId) {
        duplicate = elsewhere;
        return restore(current);
      }
      return current.map((slot) =>
        slot.fileId === pendingId
          ? {
              ...slot,
              fileId: result.fileId,
              // The variant the card shows, from now on: it is what the
              // visitor will see, and it loads where a local preview may not.
              previewUrl: result.thumbnailUrl ?? slot.previewUrl,
              uploading: false,
              broken: false,
            }
          : slot,
      );
    });
    if (duplicate) {
      fail("duplicatePhoto");
      return;
    }
    if (replacing && replacing.fileId !== result.fileId) {
      void discard(replacing.fileId);
    }
    unsaved.current.add(result.fileId);
  }

  function markBroken(fileId: string) {
    setSlots((current) =>
      current.map((slot) =>
        slot.fileId === fileId ? { ...slot, broken: true } : slot,
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
    setArchive({
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
        setArchive((current) =>
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
      setArchive((current) => (current?.fileId === pendingId ? null : current));
      if (result.failure !== "aborted") uploadFail(result.failure);
      return;
    }
    unsaved.current.add(result.fileId);
    setArchive({
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
      setArchive(null);
      return;
    }
    if (archive) void discard(archive.fileId);
    setArchive(null);
  }

  function removePhoto(fileId: string) {
    setSlots((current) => current.filter((slot) => slot.fileId !== fileId));
    void discard(fileId);
  }

  function setMain(fileId: string) {
    setSlots((current) => {
      const chosen = current.find((slot) => slot.fileId === fileId);
      if (!chosen) return current;
      return [chosen, ...current.filter((slot) => slot !== chosen)];
    });
  }

  async function save() {
    setError(null);
    if (slots.some((slot) => slot.uploading) || archive?.uploading) {
      return fail("uploading");
    }
    const trimmedName = name.trim();
    if (!trimmedName) return fail("nameRequired");
    if (slots.length === 0) return fail("photoRequired");
    const parsed = workInputSchema.safeParse({
      name: trimmedName,
      investor,
      developer,
      imageFileIds: slots.map((slot) => slot.fileId),
      r360FileId: archive?.fileId ?? null,
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
    } catch {
      fail("generic");
    } finally {
      setSaving(false);
    }
  }

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
      className="flex flex-col gap-(--sp-6)"
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
                <span
                  className="absolute right-1.5 bottom-1.5 rounded-full bg-(--n-950)/80 px-2 py-0.5 type-eyebrow text-white"
                  role="status"
                >
                  {t("photos.uploading")}
                </span>
              ) : (
                <span className="absolute top-1.5 right-1.5 flex gap-1">
                  {/* Replace: a picker for one file that takes this tile's
                      place, so a replaced main photo stays main. */}
                  <label
                    title={t("photos.replace")}
                    className={`${TILE_ACTION_CLASS} cursor-pointer`}
                  >
                    <Icon name="upload" size={12} />
                    <span className="sr-only">{t("photos.replace")}</span>
                    <input
                      type="file"
                      accept={IMAGE_CONTENT_TYPES.join(",")}
                      className="sr-only"
                      data-testid={`work-photo-replace-${index}`}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void replacePhoto(slot, file, event.target);
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
                    <Icon name="x" size={12} />
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
                multiple
                accept={IMAGE_CONTENT_TYPES.join(",")}
                className="sr-only"
                data-testid="work-photos"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length > 0) void pickPhotos(files, event.target);
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
        {notice && (
          <p role="status" className="type-sm text-(--text-body)">
            {notice}
          </p>
        )}
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
            <span
              className={`inline-flex items-center rounded-full px-(--sp-3) py-(--sp-1) type-eyebrow ${
                archive.uploading
                  ? "bg-(--state-warning-bg) text-(--state-warning)"
                  : "bg-(--state-success-bg) text-(--state-success)"
              }`}
              role="status"
            >
              {archive.uploading
                ? t("r360.uploadingPercent", {
                    percent: Math.round((archive.progress ?? 0) * 100),
                  })
                : t("r360.uploaded")}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono type-sm text-(--text-body)">
              {archive.name || t("r360.attached")}
              {" · "}
              {formatBytes(archive.sizeBytes, format)}
            </span>
            <Button variant="quiet" onClick={removeArchive} disabled={saving}>
              {archive.uploading ? t("r360.cancel") : t("r360.remove")}
            </Button>
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
                if (file) void pickArchive(file, event.target);
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

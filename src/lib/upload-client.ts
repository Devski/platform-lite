"use client";

import { postJson } from "@/lib/api-client";
import {
  ARCHIVE_CONTENT_TYPES,
  ARCHIVE_MAX_BYTES,
} from "@/lib/archive-upload-shared";
import {
  IMAGE_CONTENT_TYPES,
  IMAGE_MAX_BYTES,
  type ImagePurpose,
} from "@/lib/image-upload-shared";
import { IMMUTABLE_CACHE_CONTROL } from "@/lib/storage-shared";

// The #12 upload contract from the browser's side, in one place since #72
// (it used to live in the owner's page for the avatar alone): presign a
// staging slot, PUT the file straight to storage with the signed headers
// (G4 — the bytes never touch the app server), confirm so the server
// verifies and publishes, and hand back the original's file id for the
// caller to point something at.

export type UploadFailure =
  // The browser's own two guards, before any request.
  | "file_type"
  | "file_size"
  | "archive_type"
  | "archive_size"
  | "not_found"
  // The owner stopped it; nothing to word.
  | "aborted"
  // The storage PUT itself.
  | "upload_failed"
  // A code the server answered with (the pipeline's, or rate_limited), or
  // "generic" for anything without one.
  | "quota_exceeded"
  | "too_large"
  | "not_an_image"
  | "unsupported_format"
  | "rate_limited"
  | "generic";

const SERVER_CODES = new Set<UploadFailure>([
  "quota_exceeded",
  "too_large",
  "not_an_image",
  "unsupported_format",
  "not_found",
  "rate_limited",
]);

function serverFailure(code: unknown, status: number): UploadFailure {
  if (status === 429) return "rate_limited";
  if (typeof code === "string" && SERVER_CODES.has(code as UploadFailure)) {
    return code as UploadFailure;
  }
  return "generic";
}

export type UploadResult =
  | {
      ok: true;
      fileId: string;
      /** The 480 px variant's URL, when the server named its variants:
       * what a page shows for the photo from now on (#79). */
      thumbnailUrl?: string;
    }
  | { ok: false; failure: UploadFailure };

export async function uploadImage(
  file: File,
  purpose: ImagePurpose,
  options: UploadOptions = {},
): Promise<UploadResult> {
  if (!(IMAGE_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, failure: "file_type" };
  }
  if (file.size === 0 || file.size > IMAGE_MAX_BYTES) {
    return { ok: false, failure: "file_size" };
  }
  try {
    const presign = await postJson<{
      error?: string;
      stagingKey?: string;
      uploadUrl?: string;
    }>("/api/uploads/presign", {
      sizeBytes: file.size,
      contentType: file.type,
    });
    if (!presign.ok || !presign.data.stagingKey || !presign.data.uploadUrl) {
      return {
        ok: false,
        failure: serverFailure(presign.data.error, presign.status),
      };
    }
    // The bytes go the archive's way (#80): progress reported, a cancel
    // honoured, and a PUT that fails or is cut off abandons the staged
    // bytes so the reservation is released now, not at the window's end.
    const put = await putWithProgress(
      presign.data.uploadUrl,
      file,
      file.type,
      options,
    );
    if (put !== "ok") {
      await abandon(presign.data.stagingKey);
      return {
        ok: false,
        failure: put === "aborted" ? "aborted" : "upload_failed",
      };
    }
    // The bytes have landed; what follows is the server's decode and
    // publish, shown as "processing" from here on.
    options.onProgress?.(1);
    const confirm = await postJson<{
      error?: string;
      original?: { fileId: string };
      variants?: { kind: string; url: string }[];
    }>("/api/uploads/confirm", {
      stagingKey: presign.data.stagingKey,
      purpose,
    });
    if (!confirm.ok || !confirm.data.original) {
      return {
        ok: false,
        failure: serverFailure(confirm.data.error, confirm.status),
      };
    }
    const thumbnailUrl = confirm.data.variants?.find((variant) =>
      variant.kind.endsWith("-480"),
    )?.url;
    return {
      ok: true,
      fileId: confirm.data.original.fileId,
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
    };
  } catch {
    return { ok: false, failure: "generic" };
  }
}

// #72 / A12: the R360 archive — the same shape as an image, against the
// archive routes, with no size limit but S3's own. A zip is told by its
// declared type, or by its name when the browser sends no type at all.
export type ArchiveUploadResult =
  | { ok: true; fileId: string; sizeBytes: number }
  | { ok: false; failure: UploadFailure };

export interface UploadOptions {
  /** 0..1, as the bytes leave the browser. */
  onProgress?: (fraction: number) => void;
  /** Aborts the transfer; the staged bytes are then abandoned server-side. */
  signal?: AbortSignal;
}

// The PUT through XMLHttpRequest, the one API that reports UPLOAD progress
// and can be aborted mid-body — a transfer of an archive can run for an
// hour, and "Wysyłanie…" with no number and no way out is not a state to
// leave an owner in (step 5 review).
function putWithProgress(
  url: string,
  file: File,
  type: string,
  options: UploadOptions,
): Promise<"ok" | "failed" | "aborted"> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", type);
    xhr.setRequestHeader("cache-control", IMMUTABLE_CACHE_CONTROL);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () =>
      resolve(xhr.status >= 200 && xhr.status < 300 ? "ok" : "failed");
    xhr.onerror = () => resolve("failed");
    xhr.onabort = () => resolve("aborted");
    options.signal?.addEventListener("abort", () => xhr.abort(), {
      once: true,
    });
    if (options.signal?.aborted) {
      resolve("aborted");
      return;
    }
    xhr.send(file);
  });
}

// Tells the server the staged upload is not coming, so the reserved bytes
// stop counting now rather than at the window's end. Best-effort.
function abandon(stagingKey: string): Promise<unknown> {
  return postJson("/api/uploads/abandon", { stagingKey }).catch(
    () => undefined,
  );
}

export async function uploadArchive(
  file: File,
  options: UploadOptions = {},
): Promise<ArchiveUploadResult> {
  const type =
    file.type ||
    (file.name.toLowerCase().endsWith(".zip") ? "application/zip" : "");
  if (!(ARCHIVE_CONTENT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, failure: "archive_type" };
  }
  if (file.size === 0 || file.size > ARCHIVE_MAX_BYTES) {
    return { ok: false, failure: "archive_size" };
  }
  try {
    const presign = await postJson<{
      error?: string;
      stagingKey?: string;
      uploadUrl?: string;
    }>("/api/uploads/presign-archive", {
      sizeBytes: file.size,
      contentType: type,
    });
    if (!presign.ok || !presign.data.stagingKey || !presign.data.uploadUrl) {
      return {
        ok: false,
        failure: serverFailure(presign.data.error, presign.status),
      };
    }
    const put = await putWithProgress(
      presign.data.uploadUrl,
      file,
      type,
      options,
    );
    if (put !== "ok") {
      void abandon(presign.data.stagingKey);
      return {
        ok: false,
        failure: put === "aborted" ? "aborted" : "upload_failed",
      };
    }
    const confirm = await postJson<{
      error?: string;
      fileId?: string;
      sizeBytes?: number;
    }>("/api/uploads/confirm-archive", {
      stagingKey: presign.data.stagingKey,
    });
    if (!confirm.ok || !confirm.data.fileId) {
      return {
        ok: false,
        failure: serverFailure(confirm.data.error, confirm.status),
      };
    }
    return {
      ok: true,
      fileId: confirm.data.fileId,
      sizeBytes: confirm.data.sizeBytes ?? file.size,
    };
  } catch {
    return { ok: false, failure: "generic" };
  }
}

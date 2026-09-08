"use client";

import { postJson } from "@/lib/api-client";
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
  { ok: true; fileId: string } | { ok: false; failure: UploadFailure };

export async function uploadImage(
  file: File,
  purpose: ImagePurpose,
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
    // Its own try: a PUT the browser cannot even send (CORS, a dropped
    // connection) is an upload failure, not "something went wrong".
    let uploaded = false;
    try {
      const upload = await fetch(presign.data.uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": file.type,
          "cache-control": IMMUTABLE_CACHE_CONTROL,
        },
        body: file,
      });
      uploaded = upload.ok;
    } catch {
      uploaded = false;
    }
    if (!uploaded) return { ok: false, failure: "upload_failed" };
    const confirm = await postJson<{
      error?: string;
      original?: { fileId: string };
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
    return { ok: true, fileId: confirm.data.original.fileId };
  } catch {
    return { ok: false, failure: "generic" };
  }
}

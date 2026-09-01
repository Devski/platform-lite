"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/api-client";
import { AVATAR_CONTENT_TYPES, AVATAR_MAX_BYTES } from "@/lib/avatar-shared";
import { IMMUTABLE_CACHE_CONTROL } from "@/lib/storage-shared";

// The #12 upload contract, from the browser's side: presign a staging slot,
// PUT the file straight to storage with the three signed headers (G4 — the
// bytes never touch the app server), confirm so the server verifies and
// publishes, then point the profile at the returned original.

const SERVER_ERROR_KEYS = new Set([
  "quota_exceeded",
  "too_large",
  "not_an_image",
  "unsupported_format",
  "invalid_avatar",
  "rate_limited",
]);

export function AvatarSection({ currentUrl }: { currentUrl: string | null }) {
  const t = useTranslations("Settings.profile.avatar");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function serverError(code: unknown, status: number): string {
    if (status === 429) return t("errors.rate_limited");
    if (typeof code === "string" && SERVER_ERROR_KEYS.has(code)) {
      return t(`errors.${code}`);
    }
    return t("errors.generic");
  }

  async function handleFile(file: File) {
    setError(null);
    setDone(false);
    if (!(AVATAR_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      setError(t("errors.file_type"));
      return;
    }
    if (file.size === 0 || file.size > AVATAR_MAX_BYTES) {
      setError(t("errors.file_size"));
      return;
    }

    setBusy(true);
    try {
      const presign = await postJson<{
        error?: string;
        stagingKey?: string;
        uploadUrl?: string;
      }>("/api/avatar/presign", {
        sizeBytes: file.size,
        contentType: file.type,
      });
      if (!presign.ok || !presign.data.stagingKey || !presign.data.uploadUrl) {
        setError(serverError(presign.data.error, presign.status));
        return;
      }

      // The three headers ride the presigned signature — storage refuses the
      // upload if any of them differs from what the server declared.
      const upload = await fetch(presign.data.uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": file.type,
          "cache-control": IMMUTABLE_CACHE_CONTROL,
        },
        body: file,
      });
      if (!upload.ok) {
        setError(t("errors.upload_failed"));
        return;
      }

      const confirm = await postJson<{
        error?: string;
        original?: { fileId: string };
      }>("/api/avatar/confirm", { stagingKey: presign.data.stagingKey });
      if (!confirm.ok || !confirm.data.original) {
        setError(serverError(confirm.data.error, confirm.status));
        return;
      }

      const assign = await postJson<{ error?: string }>(
        "/api/profile/avatar",
        { fileId: confirm.data.original.fileId },
      );
      if (!assign.ok) {
        setError(serverError(assign.data.error, assign.status));
        return;
      }

      setDone(true);
      router.refresh();
    } catch {
      // Network-level failure anywhere along the chain.
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {currentUrl ? (
        // Pre-optimized WebP served from storage (G2/G5) — next/image would
        // only re-proxy an already-final asset from a runtime-configured host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUrl}
          alt={t("currentAlt")}
          width={128}
          height={128}
          className="h-32 w-32 rounded-full border border-gray-200 object-cover"
        />
      ) : (
        <p className="text-sm text-gray-600">{t("empty")}</p>
      )}

      <label
        htmlFor="avatar-file"
        className="text-sm font-medium text-gray-700"
      >
        {t("chooseLabel")}
      </label>
      <input
        ref={inputRef}
        id="avatar-file"
        name="avatar"
        type="file"
        accept={AVATAR_CONTENT_TYPES.join(",")}
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
        className="text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-800"
      />
      <p className="text-sm text-gray-500">{t("hint")}</p>

      {busy && (
        <p className="text-sm text-gray-600" role="status">
          {t("uploading")}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="text-sm text-green-700" role="status">
          {t("done")}
        </p>
      )}
    </div>
  );
}

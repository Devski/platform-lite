"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { AccountMenu } from "@/components/ui/account-menu";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { LogoMark } from "@/components/ui/logo-mark";
import { Plaque } from "@/components/ui/plaque";
import { TopBar } from "@/components/ui/top-bar";
import { postJson } from "@/lib/api-client";
import { AVATAR_CONTENT_TYPES, AVATAR_MAX_BYTES } from "@/lib/avatar-shared";
import { DISPLAY_NAME_MAX, displayNameSchema } from "@/lib/profile-schemas";
import { IMMUTABLE_CACHE_CONTROL } from "@/lib/storage-shared";

const AVATAR_ERROR_KEYS = new Set([
  "quota_exceeded",
  "too_large",
  "not_an_image",
  "unsupported_format",
  "invalid_avatar",
  "rate_limited",
]);

interface OwnerProfile {
  handle: string;
  displayName: string;
  avatar: { url128: string } | null;
}

// #58: the owner's own view of their public profile — the same shell as a
// visitor's (screen 2), just with the top bar's edit chrome and, once the
// pencil is on, the avatar and name turning into their own editable
// controls right on the card instead of a separate settings form.
export function OwnerProfileView({ profile }: { profile: OwnerProfile }) {
  const t = useTranslations("PublicProfile");
  const tAvatar = useTranslations("Settings.profile.avatar");
  const tName = useTranslations("Settings.profile.name");
  const router = useRouter();
  const wordmark = useTranslations("Brand")("wordmark");

  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(profile.displayName);
  // Adjusting state during render (not in an effect) when the prop the
  // input was seeded from changes — the pattern React's docs recommend for
  // this, since a save's router.refresh() is the only thing that ever
  // changes profile.displayName from outside the input itself.
  const [syncedName, setSyncedName] = useState(profile.displayName);
  if (profile.displayName !== syncedName) {
    setSyncedName(profile.displayName);
    setName(profile.displayName);
  }
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveName() {
    setNameError(null);
    const trimmed = name.trim();
    if (trimmed === profile.displayName) return;
    const parsed = displayNameSchema.safeParse(trimmed);
    if (!parsed.success) {
      setNameError(tName("errors.invalid", { max: DISPLAY_NAME_MAX }));
      return;
    }
    setNameSaving(true);
    try {
      const response = await postJson("/api/profile", {
        displayName: parsed.data,
      });
      if (!response.ok) {
        setNameError(
          tName(
            response.status === 429 ? "errors.rateLimited" : "errors.generic",
          ),
        );
        return;
      }
      router.refresh();
    } catch {
      setNameError(tName("errors.generic"));
    } finally {
      setNameSaving(false);
    }
  }

  function avatarErrorCopy(code: unknown, status: number): string {
    if (status === 429) return tAvatar("errors.rate_limited");
    if (typeof code === "string" && AVATAR_ERROR_KEYS.has(code)) {
      return tAvatar(`errors.${code}`);
    }
    return tAvatar("errors.generic");
  }

  // The #12 upload contract from the browser's side, and since #58 the only
  // copy of it: presign a staging slot, PUT the file straight to storage with
  // the signed headers (G4 — the bytes never touch the app server), confirm
  // so the server verifies and publishes, then point the profile at the
  // returned original.
  async function handleAvatarFile(file: File) {
    setAvatarError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!(AVATAR_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      setAvatarError(tAvatar("errors.file_type"));
      return;
    }
    if (file.size === 0 || file.size > AVATAR_MAX_BYTES) {
      setAvatarError(tAvatar("errors.file_size"));
      return;
    }
    setAvatarBusy(true);
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
        setAvatarError(avatarErrorCopy(presign.data.error, presign.status));
        return;
      }
      const upload = await fetch(presign.data.uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": file.type,
          "cache-control": IMMUTABLE_CACHE_CONTROL,
        },
        body: file,
      });
      if (!upload.ok) {
        setAvatarError(tAvatar("errors.upload_failed"));
        return;
      }
      const confirm = await postJson<{
        error?: string;
        original?: { fileId: string };
      }>("/api/avatar/confirm", { stagingKey: presign.data.stagingKey });
      if (!confirm.ok || !confirm.data.original) {
        setAvatarError(avatarErrorCopy(confirm.data.error, confirm.status));
        return;
      }
      const assign = await postJson<{ error?: string }>(
        "/api/profile/avatar",
        { fileId: confirm.data.original.fileId },
      );
      if (!assign.ok) {
        setAvatarError(avatarErrorCopy(assign.data.error, assign.status));
        return;
      }
      router.refresh();
    } catch {
      setAvatarError(tAvatar("errors.generic"));
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <TopBar
        maxWidth="measure-page"
        left={<LogoMark href={`/${profile.handle}`} wordmark={wordmark} />}
        right={
          <>
            <IconButton
              icon="pencil"
              label={t("editProfile")}
              pressed={editing}
              onClick={() => {
                setEditing((v) => !v);
                // A failed save shouldn't keep shouting once the owner has
                // stepped away from editing — or back in for another try.
                setNameError(null);
                setAvatarError(null);
              }}
            />
            <AccountMenu
              handle={profile.handle}
              avatarUrl={profile.avatar?.url128 ?? null}
              displayName={profile.displayName}
            />
          </>
        }
      />
      <main className="mx-auto flex max-w-(--measure-page) flex-col gap-(--sp-5) px-(--sp-5) pt-(--sp-7) pb-(--sp-10) sm:gap-(--sp-6) sm:px-(--sp-7) sm:pt-(--sp-10) sm:pb-(--sp-14)">
        <Card as="article" padding="lg">
          {/* Stacked below sm, exactly as the visitor's copy of this card is
              (screen 2): a 128px avatar plus a display-size name cannot
              share the 248px a 360px phone leaves inside the card, and the
              name was the half that ran off the right edge. The type needs
              no breakpoint — --fs-display is a clamp() that has already
              stepped 48px down to 32px by the time a phone reads it. */}
          <div className="flex flex-col gap-(--sp-5) sm:flex-row sm:flex-wrap sm:items-center sm:gap-(--sp-8)">
            {/* One variable sizes the avatar and the box the camera button
                is pinned inside, so the two can never drift apart. */}
            <div className="relative h-(--avatar-size) w-(--avatar-size) shrink-0 [--avatar-size:96px] sm:[--avatar-size:128px]">
              <Avatar
                src={profile.avatar?.url128 ?? null}
                name={profile.displayName}
                size={128}
                alt={t("avatarAlt", { name: profile.displayName })}
              />
              {editing && (
                <>
                  <label
                    htmlFor="owner-avatar-file"
                    className="absolute right-0 bottom-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-(--surface-card) bg-(--action-solid) text-(--action-solid-text) shadow-md hover:bg-(--action-solid-hover)"
                  >
                    <Icon name="camera" size={16} />
                  </label>
                  <input
                    ref={fileInputRef}
                    id="owner-avatar-file"
                    type="file"
                    accept={AVATAR_CONTENT_TYPES.join(",")}
                    disabled={avatarBusy}
                    aria-invalid={avatarError ? true : undefined}
                    aria-describedby={avatarError ? "profile-edit-error" : undefined}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleAvatarFile(file);
                    }}
                    className="sr-only"
                  />
                </>
              )}
            </div>
            <div className="flex w-full min-w-0 flex-col gap-(--sp-4) sm:flex-1">
              {editing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={saveName}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                  maxLength={DISPLAY_NAME_MAX}
                  aria-label={tName("label")}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? "profile-edit-error" : undefined}
                  disabled={nameSaving}
                  className="type-display w-full border-b-2 border-(--border-default) bg-transparent text-(--text-strong) focus:border-(--action-solid) focus:outline-none"
                />
              ) : (
                // break-words is the guarantee, not the layout: a display
                // name is one 80-character field and may hold a single word
                // longer than any column we can give it.
                <h1 className="type-display break-words text-(--text-strong)">
                  {profile.displayName}
                </h1>
              )}
              {avatarBusy && (
                <p className="type-sm text-(--text-muted)" role="status">
                  {tAvatar("uploading")}
                </p>
              )}
              {/* One shared slot for both fields' errors. If a stale name
                  error and a fresh avatar error were both pending it would
                  show only the name one — rare enough in one editing pass
                  not to warrant two separate slots. */}
              {(nameError || avatarError) && (
                <p id="profile-edit-error" className="type-sm text-(--state-danger)" role="alert">
                  {nameError ?? avatarError}
                </p>
              )}
            </div>
          </div>
        </Card>
        <Card padding="sm" tone="sunken">
          <div className="flex flex-wrap items-center gap-(--sp-4)">
            <Badge uppercase>{t("scopeBadge")}</Badge>
            <span className="type-sm text-(--text-muted)">
              {t("ownerScopeNote")}
            </span>
          </div>
        </Card>
        <EmptyState
          icon="folder-open"
          title={t("emptyStateTitle")}
          body={t("emptyStateBody")}
        />
      </main>
      <div className="mx-auto flex max-w-(--measure-page) justify-center px-(--sp-5) py-(--sp-7) sm:px-(--sp-7) sm:py-(--sp-8)">
        <Plaque name={profile.displayName} width={150} tilt={0} shadow={false} />
      </div>
    </>
  );
}

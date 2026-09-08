"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { AccountMenu } from "@/components/ui/account-menu";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { LogoMark } from "@/components/ui/logo-mark";
import { Plaque } from "@/components/ui/plaque";
import { Textarea } from "@/components/ui/textarea";
import { TopBar } from "@/components/ui/top-bar";
import { postJson } from "@/lib/api-client";
import { IMAGE_CONTENT_TYPES } from "@/lib/image-upload-shared";
import {
  BIO_MAX,
  bioSchema,
  DISPLAY_NAME_MAX,
  displayNameSchema,
  HEADLINE_MAX,
  headlineSchema,
  LOCATION_MAX,
  LOCATIONS_MAX,
  locationsSchema,
} from "@/lib/profile-schemas";
import type { Place, searchPlaces } from "@/lib/teryt";
import { uploadImage, type UploadFailure } from "@/lib/upload-client";
import { WORKS_MAX } from "@/lib/work-schemas";
import { LeaveDialog } from "./leave-dialog";
import { useLeaveGuard } from "./use-leave-guard";
import { WorkForm } from "./work-form";
import { WorksGallery, type GalleryWork } from "./works-gallery";
import {
  BioView,
  CARD_BODY_CLASS,
  CoverView,
  HeadlineView,
  LocationsView,
  PlaceChip,
  SectionHeading,
} from "./profile-sections";

interface OwnerProfile {
  handle: string;
  displayName: string;
  avatar: { url128: string } | null;
  cover: { url1600: string; url480: string } | null;
  headline: string | null;
  locations: string[];
  bio: string | null;
}

// The editable fields as the server holds them, "" and [] for none.
interface Fields {
  name: string;
  headline: string;
  bio: string;
  locations: string[];
}

function fieldsOf(profile: OwnerProfile): Fields {
  return {
    name: profile.displayName,
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    locations: profile.locations,
  };
}

type SectionsErrorKey = "invalid" | "rateLimited" | "generic";

// The one call every section makes: a subset of the A12 fields, answered
// with a dictionary key on failure and nothing on success.
async function postSections(
  body: Record<string, unknown>,
): Promise<SectionsErrorKey | null> {
  try {
    const response = await postJson("/api/profile/sections", body);
    if (response.ok) return null;
    return response.status === 429 ? "rateLimited" : "generic";
  } catch {
    return "generic";
  }
}

// #58: the owner's own view of their public profile — the same shell as a
// visitor's (screen 2), with the top bar's edit control and, once editing
// is on, the avatar, the name and (since #72) the headline, the places and
// the bio turning into their own controls right on the card.
//
// While editing, the fields on screen are the truth: each one posts itself
// when it is left and keeps what it posted. Nothing refreshes the page until
// "Zapisz", which waits for every save still in flight and refreshes once —
// a refresh per field raced the next field, and a stale server copy landing
// after an optimistic change wiped it (#72 step 2 review). Out of editing
// the server's copy is the truth, re-seeded from the prop during render (the
// pattern React's docs recommend for derived state), and only then.
export function OwnerProfileView({
  profile,
  works,
}: {
  profile: OwnerProfile;
  /** The owner's works with their file ids, for the form. */
  works: GalleryWork[];
}) {
  const t = useTranslations("PublicProfile");
  const tWorks = useTranslations("Works");
  const [workForm, setWorkForm] = useState<
    { kind: "new" } | { kind: "edit"; work: GalleryWork } | null
  >(null);
  const tAvatar = useTranslations("Settings.profile.avatar");
  const tCover = useTranslations("Settings.profile.cover");
  const tUpload = useTranslations("Settings.profile.upload");
  const tName = useTranslations("Settings.profile.name");
  const tSections = useTranslations("Settings.profile.sections");
  const router = useRouter();
  const wordmark = useTranslations("Brand")("wordmark");

  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // #83: leaving the page mid-edit asks first. Confirmed leaving ends the
  // editing without the save-on-exit pass: what was saved stays, an open
  // work form and its uploads are let go (the form's unmount discards them).
  const leaveGuard = useLeaveGuard(editing, () => setEditing(false));
  const [savedNotice, setSavedNotice] = useState(false);
  useEffect(() => {
    if (!savedNotice) return;
    const timer = setTimeout(() => setSavedNotice(false), 2500);
    return () => clearTimeout(timer);
  }, [savedNotice]);

  const [fields, setFields] = useState(() => fieldsOf(profile));
  // What the server holds, as far as this page knows: seeded with the prop,
  // advanced by every successful save. A field equal to it is not re-sent.
  const [saved, setSaved] = useState(() => fieldsOf(profile));
  const [synced, setSynced] = useState(profile);
  if (!editing && profile !== synced) {
    setSynced(profile);
    setFields(fieldsOf(profile));
    setSaved(fieldsOf(profile));
  }
  const setField = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((current) => ({ ...current, [key]: value }));
  const markSaved = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setSaved((current) => ({ ...current, [key]: value }));

  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [headlineError, setHeadlineError] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const headlineId = useId();
  const bioId = useId();
  const locationsId = useId();

  // Saves still in flight, each resolving to whether it succeeded, so
  // "Zapisz" can wait for them and stay open if one failed.
  const pending = useRef(new Set<Promise<boolean>>());
  function track(save: Promise<boolean>): Promise<boolean> {
    pending.current.add(save);
    void save.finally(() => pending.current.delete(save));
    return save;
  }

  function saveName(): Promise<boolean> {
    return track(
      (async () => {
        setNameError(null);
        const trimmed = fields.name.trim();
        if (trimmed === saved.name) return true;
        const parsed = displayNameSchema.safeParse(trimmed);
        if (!parsed.success) {
          setNameError(tName("errors.invalid", { max: DISPLAY_NAME_MAX }));
          return false;
        }
        setNameSaving(true);
        try {
          const response = await postJson("/api/profile", {
            displayName: parsed.data,
          });
          if (!response.ok) {
            setNameError(
              tName(
                response.status === 429
                  ? "errors.rateLimited"
                  : "errors.generic",
              ),
            );
            return false;
          }
          markSaved("name", parsed.data);
          setField("name", parsed.data);
          return true;
        } catch {
          setNameError(tName("errors.generic"));
          return false;
        } finally {
          setNameSaving(false);
        }
      })(),
    );
  }

  // The headline and the bio share one shape: validate with the shared
  // schema, skip an unchanged value, post the one field, keep it.
  function saveText(
    field: "headline" | "bio",
    setError: (message: string | null) => void,
  ): Promise<boolean> {
    return track(
      (async () => {
        setError(null);
        const schema = field === "headline" ? headlineSchema : bioSchema;
        const parsed = schema.safeParse(fields[field]);
        if (!parsed.success) {
          setError(tSections("errors.invalid"));
          return false;
        }
        if (parsed.data === saved[field]) return true;
        const failure = await postSections({ [field]: parsed.data });
        if (failure) {
          setError(tSections(`errors.${failure}`));
          return false;
        }
        markSaved(field, parsed.data);
        return true;
      })(),
    );
  }

  function saveLocations(next: string[]): Promise<boolean> {
    return track(
      (async () => {
        setLocationsError(null);
        const parsed = locationsSchema.safeParse(next);
        if (!parsed.success) {
          setLocationsError(tSections("errors.invalid"));
          return false;
        }
        const previous = fields.locations;
        setField("locations", parsed.data);
        const failure = await postSections({ locations: parsed.data });
        if (failure) {
          setLocationsError(tSections(`errors.${failure}`));
          setField("locations", previous);
          return false;
        }
        markSaved("locations", parsed.data);
        return true;
      })(),
    );
  }

  function addPlace(raw: string) {
    const place = raw.trim();
    if (!place) return;
    const folded = place.toLocaleLowerCase("pl");
    if (
      fields.locations.some(
        (existing) => existing.toLocaleLowerCase("pl") === folded,
      )
    ) {
      setLocationsError(tSections("locations.duplicate"));
      return;
    }
    if (fields.locations.length >= LOCATIONS_MAX) {
      setLocationsError(tSections("locations.tooMany", { max: LOCATIONS_MAX }));
      return;
    }
    void saveLocations([...fields.locations, place]);
  }

  function removePlace(place: string) {
    void saveLocations(
      fields.locations.filter((existing) => existing !== place),
    );
  }

  // The words for a failed upload are shared by the avatar and the cover
  // (Settings.profile.upload); only the final "point the profile at it"
  // step has a code of its own per slot.
  function uploadErrorCopy(failure: UploadFailure): string {
    return tUpload(`errors.${failure}`);
  }
  function assignErrorCopy(
    slot: "avatar" | "cover",
    code: unknown,
    status: number,
  ): string {
    if (status === 429) return tUpload("errors.rate_limited");
    if (slot === "avatar" && code === "invalid_avatar") {
      return tAvatar("errors.invalid_avatar");
    }
    if (slot === "cover" && code === "invalid_cover") {
      return tCover("errors.invalid_cover");
    }
    return tUpload("errors.generic");
  }

  // A photo (avatar or cover) is the one change that refreshes at once: its
  // URLs come from the server and nothing on this page holds them. The
  // upload chain itself lives in lib/upload-client (#12, shared since #72).
  async function handleImageFile(
    slot: "avatar" | "cover",
    file: File,
    input: HTMLInputElement | null,
    setBusy: (busy: boolean) => void,
    setError: (message: string | null) => void,
  ) {
    setError(null);
    if (input) input.value = "";
    setBusy(true);
    try {
      const result = await uploadImage(file, slot);
      if (!result.ok) {
        setError(uploadErrorCopy(result.failure));
        return;
      }
      const assign = await postJson<{ error?: string }>(
        `/api/profile/${slot}`,
        { fileId: result.fileId },
      );
      if (!assign.ok) {
        setError(assignErrorCopy(slot, assign.data.error, assign.status));
        return;
      }
      router.refresh();
    } catch {
      setError(tUpload("errors.generic"));
    } finally {
      setBusy(false);
      if (input) input.value = "";
    }
  }

  async function removeCover() {
    setCoverError(null);
    setCoverBusy(true);
    try {
      const response = await postJson<{ error?: string }>(
        "/api/profile/cover",
        { fileId: null },
      );
      if (!response.ok) {
        setCoverError(
          assignErrorCopy("cover", response.data.error, response.status),
        );
        return;
      }
      router.refresh();
    } catch {
      setCoverError(tUpload("errors.generic"));
    } finally {
      setCoverBusy(false);
    }
  }

  async function toggleEditing() {
    if (!editing) {
      setEditing(true);
      setSavedNotice(false);
      clearErrors();
      return;
    }
    // Fields save on blur; leaving takes whatever still has focus with it,
    // then waits for every save in flight. A failed one keeps the editing
    // chrome open with its error on screen — "Zapisano" is never claimed
    // for a save that did not happen.
    setLeaving(true);
    try {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
      const outcomes = await Promise.all([...pending.current]);
      if (outcomes.some((ok) => !ok)) return;
      setEditing(false);
      setSavedNotice(true);
      router.refresh();
    } finally {
      setLeaving(false);
    }
  }

  // A failed save shouldn't keep shouting once the owner has stepped back
  // in for another try.
  function clearErrors() {
    setNameError(null);
    setAvatarError(null);
    setCoverError(null);
    setHeadlineError(null);
    setBioError(null);
    setLocationsError(null);
  }

  return (
    <>
      <TopBar
        maxWidth="measure-page"
        left={<LogoMark href={`/${profile.handle}`} wordmark={wordmark} />}
        right={
          <>
            {/* A quiet button with a label and an icon, not a bare pencil
                (decision of 08.09.2026): out of editing it invites, in
                editing it names the way out. The label carries the state,
                so no aria-pressed — a toggle whose name changes would read
                "Zapisz, pressed". */}
            <Button
              variant="quiet"
              onClick={() => void toggleEditing()}
              disabled={leaving}
              aria-busy={leaving || undefined}
            >
              <Icon name={editing ? "check" : "pencil"} size={16} />
              {editing ? t("saveProfile") : t("editProfile")}
            </Button>
            <AccountMenu
              handle={profile.handle}
              avatarUrl={profile.avatar?.url128 ?? null}
              displayName={profile.displayName}
            />
          </>
        }
      />
      <main className="mx-auto flex max-w-(--measure-page) flex-col gap-(--sp-5) px-(--sp-5) pt-(--sp-7) pb-(--sp-10) sm:gap-(--sp-6) sm:px-(--sp-7) sm:pt-(--sp-10) sm:pb-(--sp-14)">
        <Card as="article" padding="none">
          {/* The cover band: the photo when there is one, a dashed slot
              while editing without one, nothing otherwise. The camera sits
              in the band's corner, as it does on the avatar. */}
          {(profile.cover || editing) && (
            <div className="relative overflow-hidden rounded-t-md">
              {profile.cover ? (
                <CoverView cover={profile.cover} name={profile.displayName} />
              ) : (
                <div className="flex aspect-[3/1] w-full items-center justify-center bg-(--surface-sunken) type-sm text-(--text-muted)">
                  {tCover("add")}
                </div>
              )}
              {editing && (
                <div className="absolute right-(--sp-5) bottom-(--sp-5) flex items-center gap-(--sp-3)">
                  {profile.cover && (
                    <Button
                      variant="onPhoto"
                      onClick={() => void removeCover()}
                      disabled={coverBusy}
                    >
                      {coverBusy ? tCover("removing") : tCover("remove")}
                    </Button>
                  )}
                  <label
                    title={profile.cover ? tCover("change") : tCover("add")}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-(--surface-card) bg-(--action-solid) text-(--action-solid-text) shadow-md hover:bg-(--action-solid-hover) focus-within:shadow-[var(--ring-focus)]"
                  >
                    <Icon name="camera" size={16} />
                    <span className="sr-only">
                      {profile.cover ? tCover("change") : tCover("add")}
                    </span>
                    <input
                      ref={coverInputRef}
                      id="owner-cover-file"
                      type="file"
                      accept={IMAGE_CONTENT_TYPES.join(",")}
                      disabled={coverBusy}
                      aria-invalid={coverError ? true : undefined}
                      aria-describedby={
                        coverError ? "profile-cover-error" : undefined
                      }
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void handleImageFile(
                            "cover",
                            file,
                            coverInputRef.current,
                            setCoverBusy,
                            setCoverError,
                          );
                        }
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
          <div className={CARD_BODY_CLASS}>
            {/* Stacked below sm, exactly as the visitor's copy of this card is
              (screen 2): a 128px avatar plus a display-size name cannot
              share the 248px a 360px phone leaves inside the card, and the
              name was the half that ran off the right edge. The type needs
              no breakpoint — --fs-display is a clamp() that has already
              stepped 48px down to 32px by the time a phone reads it. */}
            <div
              className={`flex flex-col gap-(--sp-5) sm:flex-row sm:flex-wrap sm:gap-(--sp-8) ${
                profile.cover || editing ? "sm:items-start" : "sm:items-center"
              }`}
            >
              {/* One variable sizes the avatar and the box the camera button
                is pinned inside, so the two can never drift apart. With a
                cover band above, the box straddles its lower edge. */}
              <div
                className={`relative h-(--avatar-size) w-(--avatar-size) shrink-0 [--avatar-size:96px] sm:[--avatar-size:128px] ${
                  profile.cover || editing
                    ? "-mt-(--sp-14) sm:-mt-(--sp-16)"
                    : ""
                }`}
              >
                <Avatar
                  src={profile.avatar?.url128 ?? null}
                  name={profile.displayName}
                  size={128}
                  alt={t("avatarAlt", { name: profile.displayName })}
                  className={
                    profile.cover || editing
                      ? "ring-4 ring-(--surface-card)"
                      : ""
                  }
                />
                {editing && (
                  <>
                    <label
                      title={tAvatar("change")}
                      className="absolute right-0 bottom-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-(--surface-card) bg-(--action-solid) text-(--action-solid-text) shadow-md hover:bg-(--action-solid-hover) focus-within:shadow-[var(--ring-focus)]"
                    >
                      <Icon name="camera" size={16} />
                      <span className="sr-only">{tAvatar("change")}</span>
                      <input
                        ref={fileInputRef}
                        id="owner-avatar-file"
                        type="file"
                        accept={IMAGE_CONTENT_TYPES.join(",")}
                        disabled={avatarBusy}
                        aria-invalid={avatarError ? true : undefined}
                        aria-describedby={
                          avatarError ? "profile-edit-error" : undefined
                        }
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void handleImageFile(
                              "avatar",
                              file,
                              fileInputRef.current,
                              setAvatarBusy,
                              setAvatarError,
                            );
                          }
                        }}
                        className="sr-only"
                      />
                    </label>
                  </>
                )}
              </div>
              <div className="flex w-full min-w-0 flex-col gap-(--sp-4) sm:flex-1">
                {editing ? (
                  <input
                    type="text"
                    value={fields.name}
                    onChange={(event) => setField("name", event.target.value)}
                    onBlur={() => void saveName()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                    maxLength={DISPLAY_NAME_MAX}
                    aria-label={tName("label")}
                    aria-invalid={nameError ? true : undefined}
                    aria-describedby={
                      nameError ? "profile-edit-error" : undefined
                    }
                    disabled={nameSaving}
                    className="type-display w-full border-b-2 border-(--border-default) bg-transparent text-(--text-strong) focus:border-(--action-solid) focus:outline-none"
                  />
                ) : (
                  // break-words is the guarantee, not the layout: a display
                  // name is one 80-character field and may hold a single word
                  // longer than any column we can give it.
                  <h1 className="type-display break-words text-(--text-strong)">
                    {fields.name}
                  </h1>
                )}
                {editing ? (
                  <TextSectionField
                    id={headlineId}
                    field="headline"
                    rows={2}
                    max={HEADLINE_MAX}
                    value={fields.headline}
                    error={headlineError}
                    onChange={(value) => setField("headline", value)}
                    onBlur={() => void saveText("headline", setHeadlineError)}
                  />
                ) : (
                  <HeadlineView headline={fields.headline || null} />
                )}
                {(avatarBusy || coverBusy) && (
                  <p className="type-sm text-(--text-muted)" role="status">
                    {tUpload("uploading")}
                  </p>
                )}
                {savedNotice && (
                  <p className="type-sm text-(--state-success)" role="status">
                    {t("savedProfile")}
                  </p>
                )}
                {/* One shared slot for the name's and the avatar's errors. If a
                  stale name error and a fresh avatar error were both pending
                  it would show only the name one — rare enough in one
                  editing pass not to warrant two separate slots. */}
                {coverError && (
                  <p
                    id="profile-cover-error"
                    className="type-sm text-(--state-danger)"
                    role="alert"
                  >
                    {coverError}
                  </p>
                )}
                {(nameError || avatarError) && (
                  <p
                    id="profile-edit-error"
                    className="type-sm text-(--state-danger)"
                    role="alert"
                  >
                    {nameError ?? avatarError}
                  </p>
                )}
              </div>
            </div>

            {editing ? (
              <section className="flex flex-col gap-(--sp-3)">
                <SectionHeading>{t("locationsHeading")}</SectionHeading>
                <ul className="flex flex-wrap items-center gap-(--sp-3)">
                  {fields.locations.length === 0 && (
                    <li className="type-sm text-(--text-muted)">
                      {tSections("locations.empty")}
                    </li>
                  )}
                  {fields.locations.map((place) => (
                    <li key={place} className="flex">
                      <PlaceChip
                        place={place}
                        onRemove={() => removePlace(place)}
                        removeLabel={tSections("locations.remove", { place })}
                      />
                    </li>
                  ))}
                </ul>
                <PlaceCombobox
                  id={locationsId}
                  exclude={fields.locations}
                  disabled={fields.locations.length >= LOCATIONS_MAX}
                  onAdd={addPlace}
                  error={locationsError}
                />
              </section>
            ) : (
              <LocationsView locations={fields.locations} />
            )}

            {editing ? (
              <TextSectionField
                id={bioId}
                field="bio"
                rows={6}
                max={BIO_MAX}
                value={fields.bio}
                error={bioError}
                onChange={(value) => setField("bio", value)}
                onBlur={() => void saveText("bio", setBioError)}
              />
            ) : (
              <BioView bio={fields.bio || null} />
            )}
          </div>
        </Card>
        {editing && (
          <Card padding="sm" tone="sunken">
            <p className="type-sm text-(--text-muted)">{t("ownerScopeNote")}</p>
          </Card>
        )}

        {/* #72 / A12: the works. The plus unfolds the form card above the
            list (the approved sketch); edit and delete sit on each card
            while editing. */}
        <section className="flex flex-col gap-(--sp-5)">
          <div className="flex items-center justify-between gap-(--sp-4)">
            <div className="flex items-baseline gap-(--sp-4)">
              <h2 className="type-h2 text-(--text-strong)">
                {tWorks("heading")}
              </h2>
              <span className="type-sm text-(--text-muted)">
                {tWorks("count", { count: works.length, max: WORKS_MAX })}
              </span>
              {editing && works.length >= WORKS_MAX && (
                <span className="type-sm text-(--text-muted)" id="works-limit">
                  {tWorks("limitReached", { max: WORKS_MAX })}
                </span>
              )}
            </div>
            {editing && (
              <Button
                variant="quiet"
                onClick={() =>
                  setWorkForm(workForm?.kind === "new" ? null : { kind: "new" })
                }
                disabled={works.length >= WORKS_MAX}
                aria-describedby={
                  works.length >= WORKS_MAX ? "works-limit" : undefined
                }
                title={tWorks("add")}
                aria-label={tWorks("add")}
                aria-expanded={workForm?.kind === "new"}
              >
                <Icon name="plus" size={18} />
              </Button>
            )}
          </div>
          {editing && workForm?.kind === "new" && (
            <WorkForm
              key="new"
              onSaved={() => {
                setWorkForm(null);
                router.refresh();
              }}
              onCancel={() => setWorkForm(null)}
            />
          )}
          {works.length > 0 ? (
            <WorksGallery
              works={works}
              owner={{ editing }}
              // #86: the edited work's form stands where its card was.
              inPlace={
                editing && workForm?.kind === "edit"
                  ? {
                      workId: workForm.work.id,
                      form: (
                        <WorkForm
                          key={workForm.work.id}
                          work={workForm.work}
                          onSaved={() => {
                            setWorkForm(null);
                            router.refresh();
                          }}
                          onCancel={() => setWorkForm(null)}
                        />
                      ),
                    }
                  : undefined
              }
              onEdit={(work) => setWorkForm({ kind: "edit", work })}
              onDelete={async (work) => {
                const response = await fetch(`/api/works/${work.id}`, {
                  method: "DELETE",
                }).catch(() => null);
                if (!response?.ok) return false;
                if (workForm?.kind === "edit" && workForm.work.id === work.id) {
                  setWorkForm(null);
                }
                router.refresh();
                return true;
              }}
            />
          ) : (
            !workForm && (
              <EmptyState
                icon="folder-open"
                title={tWorks("emptyTitle")}
                body={tWorks("emptyBody")}
              />
            )
          )}
        </section>
      </main>
      <div className="mx-auto flex max-w-(--measure-page) justify-center px-(--sp-5) py-(--sp-7) sm:px-(--sp-7) sm:py-(--sp-8)">
        <Plaque name={fields.name} width={150} tilt={0} shadow={false} />
      </div>
      <LeaveDialog
        open={leaveGuard.pending !== null}
        onStay={leaveGuard.stay}
        onLeave={() => leaveGuard.pending?.()}
      />
    </>
  );
}

// Ninety percent of the limit: where the counter starts to warn — and the
// only point at which it speaks up, so a screen reader is not read every
// keystroke's count.
function nearLimit(length: number, max: number): boolean {
  return length >= max * 0.9;
}

// The headline and the bio in edit mode: a labelled textarea with its hint,
// a counter that warns near the limit, and the field's own error line.
function TextSectionField({
  id,
  field,
  rows,
  max,
  value,
  error,
  onChange,
  onBlur,
}: {
  id: string;
  field: "headline" | "bio";
  rows: number;
  max: number;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const tSections = useTranslations("Settings.profile.sections");
  const near = nearLimit(value.length, max);
  return (
    <div className="flex max-w-(--measure-prose) flex-col gap-(--sp-2)">
      <label htmlFor={id} className="type-label text-(--text-body)">
        {tSections(`${field}.label`)}
      </label>
      <Textarea
        id={id}
        rows={rows}
        maxLength={max}
        value={value}
        placeholder={tSections(`${field}.placeholder`)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
      />
      <div id={`${id}-hint`} className="flex justify-between gap-(--sp-4)">
        <span className="type-sm text-(--text-muted)">
          {tSections(`${field}.hint`)}
        </span>
        <span
          className={`type-sm tabular-nums ${near ? "text-(--state-warning)" : "text-(--text-muted)"}`}
          aria-live={near ? "polite" : "off"}
        >
          {tSections("counter", { count: value.length, max })}
        </span>
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="type-sm text-(--state-danger)"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

type SearchPlaces = typeof searchPlaces;

// The place field: an input with TERYT suggestions underneath. A suggestion
// is chosen with a click or the arrow keys and Enter; Enter on the input
// itself adds what was typed, list or no list (A12: free text is allowed).
// The list itself — 16 voivodeships and every city, 39 KB — is fetched the
// first time the field is focused, so neither a visitor nor an owner who
// never edits their places pays for it.
function PlaceCombobox({
  id,
  exclude,
  disabled,
  onAdd,
  error,
}: {
  id: string;
  exclude: string[];
  disabled: boolean;
  onAdd: (place: string) => void;
  error: string | null;
}) {
  const tSections = useTranslations("Settings.profile.sections");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [search, setSearch] = useState<SearchPlaces | null>(null);
  const listId = `${id}-suggestions`;
  const hits: Place[] = open && search ? search(query, { exclude }) : [];

  function loadList() {
    if (search) return;
    void import("@/lib/teryt").then((module) =>
      setSearch(() => module.searchPlaces),
    );
  }

  function choose(place: string) {
    onAdd(place);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="flex max-w-(--measure-form) flex-col gap-(--sp-2)">
      <label htmlFor={id} className="type-label text-(--text-body)">
        {tSections("locations.label")}
      </label>
      <div className="relative">
        <Input
          id={id}
          value={query}
          disabled={disabled}
          placeholder={tSections("locations.placeholder")}
          autoComplete="off"
          maxLength={LOCATION_MAX}
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            loadList();
            setOpen(true);
          }}
          onBlur={() => {
            // Let a click on a suggestion land before the list goes away.
            setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && hits.length > 0) {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % hits.length);
            } else if (event.key === "ArrowUp" && hits.length > 0) {
              event.preventDefault();
              setActiveIndex((index) =>
                index <= 0 ? hits.length - 1 : index - 1,
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              const chosen = activeIndex >= 0 ? hits[activeIndex] : undefined;
              choose(chosen ? chosen.name : query);
            } else if (event.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
          className="w-full"
        />
        {hits.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label={tSections("locations.suggestions")}
            className="absolute top-full right-0 left-0 z-10 mt-(--sp-2) max-h-56 overflow-auto rounded-md border border-(--border-default) bg-(--surface-card) p-(--sp-2) shadow-md"
          >
            {hits.map((place, index) => (
              <li
                key={`${place.kind}:${place.name}:${place.voivodeship ?? ""}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => {
                  // mousedown, not click: the input's blur fires first and
                  // would have closed the list under a click.
                  event.preventDefault();
                  choose(place.name);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center justify-between gap-(--sp-4) rounded-sm px-(--sp-4) py-(--sp-3) type-sm ${
                  index === activeIndex
                    ? "bg-(--surface-hover) text-(--text-strong)"
                    : "text-(--text-body)"
                }`}
              >
                <span>{place.name}</span>
                <span className="type-eyebrow text-(--text-muted)">
                  {place.kind === "voivodeship"
                    ? tSections("locations.kindVoivodeship")
                    : (place.voivodeship ?? tSections("locations.kindCity"))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id={`${id}-hint`} className="type-sm text-(--text-muted)">
        {tSections("locations.hint")}
      </p>
      {error && (
        <p
          id={`${id}-error`}
          className="type-sm text-(--state-danger)"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

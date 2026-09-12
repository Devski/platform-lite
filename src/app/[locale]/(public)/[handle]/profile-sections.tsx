import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";

// #72: the reading side of the A12 sections, shared by the visitor's page
// and the owner's page out of edit mode, so the two can never drift. Each
// piece renders nothing when the profile has nothing there — a profile
// without a bio simply has no "About" heading.
// No "use client": rendered by the visitor's page as Server Components
// (§5), and bundled for the owner by the client module that imports them.

// The cover across the top of the card: a 3:1 band, the photo centre-cropped
// into it by CSS (the stored variants keep their own aspect ratio, A12), the
// 480 px width for phones and the 1600 px one from tablets up. Pre-optimized
// WebP from storage (G2/G5), as the avatar — next/image would only re-proxy
// an already-final asset.
export function CoverView({
  cover,
  name,
}: {
  cover: { url1600: string; url480: string } | null;
  name: string;
}) {
  const t = useTranslations("PublicProfile");
  if (!cover) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cover.url1600}
      srcSet={`${cover.url480} 480w, ${cover.url1600} 1600w`}
      sizes="(max-width: 640px) 100vw, 68rem"
      alt={t("coverAlt", { name })}
      className="aspect-[3/1] w-full object-cover"
    />
  );
}

// The padded body of a card whose cover bleeds to the edges (padding="none").
export const CARD_BODY_CLASS =
  "flex flex-col gap-(--sp-7) p-(--sp-9) sm:p-(--card-pad-lg)";

export function HeadlineView({ headline }: { headline: string | null }) {
  if (!headline) return null;
  return (
    <p className="type-lead max-w-(--measure-prose) text-(--text-strong)">
      {headline}
    </p>
  );
}

export function PlaceChip({
  place,
  onRemove,
  removeLabel,
  grip,
  gripLabel,
  gripHint,
  held = false,
  landing = false,
}: {
  place: string;
  /** Present only while editing: the chip grows an × that removes it. */
  onRemove?: () => void;
  removeLabel?: string;
  /**
   * Present only while editing (#66): the map pin becomes the grip that drags
   * this place up the list, and answers the arrow keys. Whatever `useReorder`
   * hands out for this index.
   */
  grip?: React.ComponentPropsWithRef<"button">;
  gripLabel?: string;
  /** The element saying which keys move it, for a screen reader. */
  gripHint?: string;
  /** This chip is the one being dragged. */
  held?: boolean;
  /** This chip is where the dragged one would land. */
  landing?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-(--sp-2) rounded-full border bg-(--surface-card) py-(--sp-1) pr-(--sp-3) pl-(--sp-3) type-label text-(--text-muted) ${
        landing && !held
          ? "border-(--border-strong) shadow-[var(--ring-focus)]"
          : "border-(--border-default)"
      } ${held ? "opacity-60" : ""}`}
    >
      {grip ? (
        <button
          type="button"
          {...grip}
          aria-label={gripLabel}
          aria-describedby={gripHint}
          title={gripLabel}
          className="-ml-1 flex h-5 w-5 cursor-grab items-center justify-center rounded-full text-(--text-subtle) hover:bg-(--surface-sunken) hover:text-(--text-body) focus-visible:shadow-[var(--ring-focus)] focus-visible:outline-none active:cursor-grabbing"
        >
          <Icon name="grip-vertical" size={14} />
        </button>
      ) : (
        <Icon
          name="map-pin"
          size={14}
          className="shrink-0 text-(--text-subtle)"
        />
      )}
      {place}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="-mr-1 flex h-5 w-5 items-center justify-center rounded-full text-(--text-subtle) hover:bg-(--surface-sunken) hover:text-(--state-danger) focus-visible:shadow-[var(--ring-focus)] focus-visible:outline-none"
        >
          <Icon name="x" size={12} />
        </button>
      )}
    </span>
  );
}

export function SectionHeading({ children }: { children: string }) {
  return <h2 className="type-eyebrow text-(--text-muted)">{children}</h2>;
}

export function LocationsView({ locations }: { locations: string[] }) {
  const t = useTranslations("PublicProfile");
  if (locations.length === 0) return null;
  return (
    <section className="flex flex-col gap-(--sp-3)">
      <SectionHeading>{t("locationsHeading")}</SectionHeading>
      <ul className="flex flex-wrap items-center gap-(--sp-3)">
        {locations.map((place) => (
          <li key={place} className="flex">
            <PlaceChip place={place} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BioView({ bio }: { bio: string | null }) {
  const t = useTranslations("PublicProfile");
  if (!bio) return null;
  return (
    <section className="flex flex-col gap-(--sp-3)">
      <SectionHeading>{t("bioHeading")}</SectionHeading>
      {/* pre-line: the stored paragraph breaks are the only formatting a
          bio has, and React escapes the rest — no markup ever runs. */}
      <p className="type-body max-w-(--measure-prose) whitespace-pre-line text-(--text-body)">
        {bio}
      </p>
    </section>
  );
}

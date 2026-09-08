import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";

// #72: the reading side of the A12 sections, shared by the visitor's page
// and the owner's page out of edit mode, so the two can never drift. Each
// piece renders nothing when the profile has nothing there — a profile
// without a bio simply has no "About" heading.
// No "use client": rendered by the visitor's page as Server Components
// (§5), and bundled for the owner by the client module that imports them.

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
}: {
  place: string;
  /** Present only while editing: the chip grows an × that removes it. */
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <span className="inline-flex items-center gap-(--sp-2) rounded-full border border-(--border-default) bg-(--surface-card) py-(--sp-1) pr-(--sp-3) pl-(--sp-3) type-label text-(--text-muted)">
      <Icon
        name="map-pin"
        size={14}
        className="shrink-0 text-(--text-subtle)"
      />
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

/**
 * One work at the full width of the page column: pictures first, words after.
 * Three layouts the owner picks per work; below `phone` every layout stacks.
 * No border, no box — the picture group and its caption are the card.
 * Replaces the two-column card grid of `works-gallery.tsx` (V-WORKS-LIST).
 *
 * @startingPoint section="Profile" subtitle="Full-width work card, three layouts" viewport="1100x720"
 */
export interface Work {
  id?: string;
  name: string;
  /** Permalink of the work's landing page, `/{handle}/{slug}` (#200). */
  href?: string;
  investor?: string;
  developer?: string;
  /** Short description; clamped to 2 lines under the picture, 6 beside it. */
  description?: string;
  /** Main picture. If the work has an orbit, the orbit takes the cover slot and this is its poster. */
  cover?: string;
  /** Further pictures; the card shows at most two. */
  thumbs?: string[];
  orbit?: { poster?: string; autorotate?: boolean; cues?: string[] } | null;
}
export interface WorkCardProps {
  work: Work;
  /** Stored with the work. `cover` one picture · `cover-thumbs` cover + two thumbnails (default) · `cover-text` picture beside the words. */
  layout?: "cover" | "cover-thumbs" | "cover-text";
  /** Stacked variant for narrow screens (< 40rem). */
  phone?: boolean;
  /** Owner view: shows the „Edytuj” pill over the cover. */
  owner?: boolean;
  /** Every picture and the name lead to the work's landing page. The orbit stays interactive in place; its corner button leads there too. */
  onOpen?: (work: Work) => void;
  /** The pill leads to the landing page in edit mode. */
  onEdit?: (work: Work) => void;
  style?: React.CSSProperties;
}
export declare function WorkCard(props: WorkCardProps): JSX.Element;

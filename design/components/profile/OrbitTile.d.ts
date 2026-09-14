/**
 * The R360 orbit tile — a picture that turns under the pointer. Design-system
 * stand-in for the product's canvas viewer (`orbit-viewer.tsx`): a poster and a
 * slow pan so layouts can be judged. Enlarging is a separate "+" button because
 * the picture itself is the drag control (D-WORKS-2). The ring is off by
 * default: never on a phone's public page (D-WORKS-19), only once enlarged on the
 * desktop profile (D-WORKS-20).
 *
 * @startingPoint section="Profile" subtitle="Orbit tile with cue points" viewport="560x420"
 */
export interface OrbitTileProps {
  /** Poster image (the orbit's start frame = the work's main picture). */
  poster?: string;
  /** Work name — used in every accessible name. */
  name?: string;
  /** Cue-point labels, rendered as a row of pill buttons under the tile. */
  cues?: string[];
  /** Turn slowly on its own until the visitor grabs it. Off under reduced motion. The owner sets this per work. */
  autorotate?: boolean;
  /** Show the ring dial over the tile's foot. */
  ring?: boolean;
  /** CSS aspect-ratio. Default "16 / 10". */
  aspect?: string;
  /** Landing page only: the corner button enlarges to the lightbox (maximize icon). */
  onEnlarge?: () => void;
  /** Profile card: the corner button leads to the work's landing page (arrow-up-right icon). Takes precedence over onEnlarge. */
  onOpen?: () => void;
  /** Accessible name of the onOpen button. Default „Otwórz realizację: {name}”. */
  openLabel?: string;
  radius?: string;
  style?: React.CSSProperties;
}
export declare function OrbitTile(props: OrbitTileProps): JSX.Element;

/**
 * The brand object: a stylised Warsaw street sign — a tall navy field with one
 * centred name in it and a red band underneath that ALWAYS reads
 * "Architektów 3d" (not an option). The lettering is Fira Sans Condensed
 * Regular 400 (never bold), ONE fixed size (44 px, the „Studio Praga” reference); the sign grows horizontally with the name.
 * The letters never shrink, the text never wraps, the sign never tilts.
 * Stylised on purpose; the city's MSI sign is not cloned.
 *
 * @startingPoint section="Brand" subtitle="Address plaque, brand and profile forms" viewport="700x320"
 */
export interface PlaqueProps {
  /** The one line in the navy field, centred. A display name, or the brand. */
  name?: string;
  /** The red band. Always "Architektów 3d". */
  footer?: string;
  /** Proportional scale of the WHOLE sign (letters, bands, padding). 1 = 44 px letters (the rule); 0.5 for the panel foot. Never used to fit a long name — the sign grows instead. Default 1. */
  scale?: number;
  /** Floor for the sign's width so short names still read as a sign. Default 200·scale. */
  minWidth?: number;
  shadow?: boolean;
  /** Hidden from assistive technology (the name is already read elsewhere). Default true. */
  decorative?: boolean;
  style?: React.CSSProperties;
}
export declare function Plaque(props: PlaqueProps): JSX.Element;

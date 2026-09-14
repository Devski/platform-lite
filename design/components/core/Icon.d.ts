/**
 * Lucide glyph, loaded from CDN and tinted with a text token. Substitution:
 * the product ships no icon set of its own, so Lucide at 1.75 stroke stands in.
 */
export interface IconProps {
  /** Lucide icon name in kebab-case, e.g. "map-pin", "arrow-right". */
  name: string;
  /** px, default 18. Use 16 inside 14px text, 20 in buttons, 24 in headers. */
  size?: number;
  tone?: "body" | "muted" | "strong" | "onPhoto" | "success" | "danger";
  strokeWidth?: number;
  style?: React.CSSProperties;
}
export declare function Icon(props: IconProps): JSX.Element;

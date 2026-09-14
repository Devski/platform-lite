/** A square, borderless control carrying one Lucide glyph — overflow menus, close, copy. */
export interface IconButtonProps {
  /** Lucide icon name, e.g. "pencil", "copy", "x". */
  icon: string;
  /** Required: the accessible name, also used as the tooltip. */
  label: string;
  /** Box size in px; the glyph is 45% of it. Default 40. */
  size?: number;
  tone?: "quiet" | "bordered" | "onPhoto";
  onClick?: (event: React.MouseEvent) => void;
  style?: React.CSSProperties;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;

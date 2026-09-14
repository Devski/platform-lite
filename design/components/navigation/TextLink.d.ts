/** Inline or standalone link. Ink, semibold, underline on hover — never blue. */
export interface TextLinkProps {
  children?: React.ReactNode;
  href?: string;
  onClick?: (event: React.MouseEvent) => void;
  tone?: "strong" | "muted" | "onPhoto";
  /** "always" for links inside a sentence, "hover" for standalone links. */
  underline?: "hover" | "always";
  /** Optional trailing Lucide glyph, e.g. "arrow-right". */
  icon?: string;
  style?: React.CSSProperties;
}
export declare function TextLink(props: TextLinkProps): JSX.Element;

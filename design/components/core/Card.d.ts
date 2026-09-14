/**
 * The product's only container: white, 1px hairline border, 8px radius, no
 * shadow at rest. Every settings section and the profile itself is one.
 */
export interface CardProps {
  children?: React.ReactNode;
  /** md = 32px (default) · lg = 48px for the profile card · sm = 20px for rows */
  padding?: "none" | "sm" | "md" | "lg";
  as?: "div" | "section" | "article" | "form" | "li";
  tone?: "default" | "sunken";
  /** Adds the hover border + shadow lift. Only for cards that are links. */
  interactive?: boolean;
  style?: React.CSSProperties;
}
export declare function Card(props: CardProps): JSX.Element;

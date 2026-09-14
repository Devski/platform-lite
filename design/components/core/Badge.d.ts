/** Small pill for a fact about the thing next to it — "free", "taken", "2FA on". */
export interface BadgeProps {
  children?: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning" | "ink";
  /** Sans + caps + tracking instead of the default mono. */
  uppercase?: boolean;
  style?: React.CSSProperties;
}
export declare function Badge(props: BadgeProps): JSX.Element;

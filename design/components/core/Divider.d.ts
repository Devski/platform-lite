/** One-pixel hairline, optionally with a small caps label in the middle. */
export interface DividerProps {
  label?: string;
  /** Vertical margin, a spacing token string. Default var(--sp-7). */
  spacing?: string;
  style?: React.CSSProperties;
}
export declare function Divider(props: DividerProps): JSX.Element;

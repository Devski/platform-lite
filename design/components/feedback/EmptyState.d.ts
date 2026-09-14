/**
 * A slot on the profile that has nothing in it yet — no photo, no name, no
 * address. Dashed border, one sentence, one action.
 */
export interface EmptyStateProps {
  /** Lucide name. Default "square-dashed". */
  icon?: string;
  title?: string;
  body?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;

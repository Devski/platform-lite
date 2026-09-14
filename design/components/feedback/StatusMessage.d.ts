/**
 * Every sentence the system says back to the user: sent, saved, rate-limited,
 * failed. Announced live — danger as alert, everything else as status.
 */
export interface StatusMessageProps {
  children?: React.ReactNode;
  tone?: "info" | "success" | "danger" | "warning";
  /** No tinted box and no icon — just the coloured line, as the forms use it. */
  plain?: boolean;
  style?: React.CSSProperties;
}
export declare function StatusMessage(props: StatusMessageProps): JSX.Element;

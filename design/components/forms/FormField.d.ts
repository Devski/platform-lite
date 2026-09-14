/**
 * Label + control + hint + error, in that order, 4px apart. Every input in
 * the product is wrapped in one.
 */
export interface FormFieldProps {
  label?: string;
  /** Must match the control's id so the label is clickable. */
  htmlFor?: string;
  /** Grey helper line, always visible: "8 to 30 characters…". */
  hint?: string;
  /** Red line with role="alert". Takes precedence over status. */
  error?: string;
  /** Neutral live line with role="status": "Checking availability…". */
  status?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function FormField(props: FormFieldProps): JSX.Element;

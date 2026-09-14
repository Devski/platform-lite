/**
 * The product's signature field: the handle that becomes the visitor's public
 * address. Origin prefix inside the border, live availability, and a preview
 * of the finished address underneath.
 *
 * @startingPoint section="Forms" subtitle="Handle input with live availability" viewport="700x200"
 */
export interface HandleFieldProps {
  label?: string;
  /** Host without a scheme; rendered as prefix and in the preview line. */
  origin?: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Drives the badge and which line the message renders as. */
  state?: "idle" | "checking" | "available" | "taken" | "reserved" | "own" | "invalid";
  /** The sentence for the current state, from the product's dictionaries. */
  message?: string;
  hint?: string;
  id?: string;
  style?: React.CSSProperties;
}
export declare function HandleField(props: HandleFieldProps): JSX.Element;

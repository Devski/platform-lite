/** Single-line text input: 48px tall, 16px text, 6px radius, 1px border that goes ink on focus. */
export interface InputProps {
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type?: "text" | "email" | "password" | "tel" | "url";
  /** Red border; pair it with a FormField error string. */
  invalid?: boolean;
  disabled?: boolean;
  /** IBM Plex Mono — for handles, codes and addresses. */
  mono?: boolean;
  /** md = 48px (default) · lg = 56px, for the onboarding name field */
  size?: "md" | "lg";
  /** Static text glued to the left inside the border, e.g. "architektow3d.pl/". */
  prefix?: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  style?: React.CSSProperties;
}
export declare function Input(props: InputProps): JSX.Element;

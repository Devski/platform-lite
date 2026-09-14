/**
 * The one action control. Ink-solid for the primary action, bordered "quiet"
 * for secondary, and the two onPhoto variants for the signed-out hero.
 *
 * @startingPoint section="Core" subtitle="Ink, quiet, ghost and on-photo actions" viewport="700x200"
 */
export interface ButtonProps {
  children?: React.ReactNode;
  /** solid = ink fill (primary) · quiet = bordered · ghost = borderless · onPhoto / onPhotoQuiet = over the hero photo */
  variant?: "solid" | "quiet" | "ghost" | "onPhoto" | "onPhotoQuiet";
  /** md = 40px (forms) · lg = 48px (hero, onboarding) */
  size?: "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
  /** Shows the label you pass while a request is in flight and blocks input. */
  loading?: boolean;
  /** Renders an anchor instead of a button. */
  href?: string;
  type?: "button" | "submit";
  onClick?: (event: React.MouseEvent) => void;
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;

/**
 * The profile's sticky bar. Transparent over the cover (the cover is the bar's
 * background), white with a hairline once the cover has scrolled away. The
 * left group — A3D mark + display name — is one button, always on screen, and
 * toggles the AboutPanel. No avatar in the bar: the avatar sits on the cover's
 * bottom edge and toggles the panel too. Replaces C-TOPBAR on profile pages.
 *
 * @startingPoint section="Profile" subtitle="Sticky bar over cover, name trigger" viewport="1100x160"
 */
export interface ProfileBarProps {
  /** Used for the toggle's accessible name. */
  profile: { displayName: string };
  /** Shown beside the mark while the panel is open (closed: the studio's name). Default „Architektów 3d”. The two crossfade. */
  brand?: string;
  /** True once the cover has left the viewport: white background, hairline, ink text. */
  solid?: boolean;
  /** Also turns the left group ink on desktop — the open panel (white, from the top of the screen) is under it. */
  aboutOpen?: boolean;
  /** Fired by the mark and the name alike. */
  onToggleAbout?: () => void;
  /** Identity editing: the mark/label button is inert (nothing may close the panel under the form). */
  toggleDisabled?: boolean;
  phone?: boolean;
  /** Right-hand slot: language chip, „Załóż konto”, account menu, „+ Realizacja”. */
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function ProfileBar(props: ProfileBarProps): JSX.Element;

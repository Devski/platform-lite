/**
 * The "about" panel — name, headline, address, places, bio and the plaque,
 * moved off the wall of work into a panel that slides in from the left. No
 * avatar inside: the page's big avatar (cover's bottom edge, centred on the
 * panel's width) sits above the panel and toggles it; `headroom` reserves the
 * space beneath it. Desktop: open on load, overlays the left edge of the works.
 * Phone: closed on load, slides over the page with a scrim. Replaces the
 * profile card of V-PROFILE / V-PROFILE-OWNER. Edit mode is the same panel
 * with frames (see `editing`).
 *
 * @startingPoint section="Profile" subtitle="Slide-in about panel" viewport="480x760"
 */
export interface AboutProfile {
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  /** Circle (default) or rounded square — set once in edit mode, followed by every avatar on the page. */
  avatarShape?: "circle" | "square";
  headline?: string;
  bio?: string;
  places?: string[];
}
export interface AboutPanelProps {
  profile: AboutProfile;
  open?: boolean;
  onClose?: () => void;
  /** What the panel's avatar does on click. Default: closes the panel (profile page). On a work page pass the way back to the profile — the avatar is the one control that goes "home". */
  onAvatar?: () => void;
  /** Drawer variant for narrow screens (< 40rem): full-height, scrim behind. */
  phone?: boolean;
  /** Owner view (kept for API compatibility; editing is started from the bar). */
  owner?: boolean;
  /** Edit mode: the same panel with frames around name, headline, bio and an add-place field; chips get a remove ×. */
  editing?: boolean;
  /** The draft being edited (shown instead of `profile` while `editing`). */
  draft?: AboutProfile;
  /** Called with a partial draft on every change. */
  onDraftChange?: (patch: Partial<AboutProfile>) => void;
  onSave?: () => void;
  onCancel?: () => void;
  onChangePhoto?: () => void;
  /** Panel width on desktop in px. Default 380. */
  width?: number;
  /** Height of the bar on desktop (with a cover the panel starts at the top of the screen, under the transparent bar; the pencil is centred in that band). Default 64. */
  top?: number;
  /** The panel's own copy of the avatar, centred, at this offset from the panel's top (the page avatar's height). Closes the panel on click. Omit for none. */
  avatarTop?: number | string;
  /** Size of that copy. Default 176. */
  avatarSize?: number;
  /** Where the panel begins. 0 with a cover (under the transparent bar); the bar's height without one, so the solid bar and its hairline do not cross the panel. Default 0. */
  start?: number;
  /** Top padding that clears the avatar: cover height + avatar/2 + gap. A px number or a CSS length/calc(). */
  headroom?: number | string;
  locale?: "pl" | "en";
  /** Extra sections (e.g. a language switcher or a table of contents of works). */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function AboutPanel(props: AboutPanelProps): JSX.Element;

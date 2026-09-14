/**
 * Sticky header for signed-in pages: A3D wordmark, section tabs with a 2px ink
 * underline, locale switch, and the account's own address plus avatar.
 *
 * @startingPoint section="Navigation" subtitle="Signed-in header with section tabs" viewport="1000x120"
 */
export interface TopBarItem {
  id: string;
  label: string;
  /** Lucide glyph name. */
  icon?: string;
}
export interface TopBarProps {
  brand?: string;
  items?: TopBarItem[];
  activeItem?: string;
  onNavigate?: (id: string) => void;
  /** Signed-in account. Omit for the signed-out header (log in + sign up). */
  user?: { name?: string; email?: string; handle?: string | null; avatarUrl?: string | null };
  locale?: string;
  onLocaleChange?: (locale: string) => void;
  /** Extra nodes before the avatar, e.g. a "View profile" button. */
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function TopBar(props: TopBarProps): JSX.Element;

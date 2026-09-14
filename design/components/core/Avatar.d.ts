/**
 * Profile photo, or the monogram fallback the product also draws into its
 * share card: initials in white on near-black.
 */
export interface AvatarProps {
  /** Storage URL of the processed photo; omit for the monogram. */
  src?: string | null;
  /** Display name — the monogram's initials come from it and it is the alt text. */
  name?: string;
  /** 32 (top bar) · 48 (rows) · 128 (public profile) · 160 (editor). Default 128. */
  size?: number;
  /** Rounded square instead of a circle (radius scales with size: xs < 48, sm < 96, md above). The owner picks the shape once (`profile.avatarShape`) and every placement follows. */
  square?: boolean;
  alt?: string;
  style?: React.CSSProperties;
}
export declare function Avatar(props: AvatarProps): JSX.Element;

import { initialsFrom, MONOGRAM_BACKGROUND, MONOGRAM_FOREGROUND } from "@/lib/monogram";

type AvatarProps = {
  src?: string | null;
  name: string;
  size?: number;
  /** Real alt text for the photo case; the initials fallback stays
   * decorative (the name next to it already says whose profile this is). */
  alt?: string;
  className?: string;
};

// design-system-source flags a real bug in the original bundle: its Avatar
// only set border-radius, not width/height, so the box shrank to the
// initials' text metrics and came out oval instead of round. Fixed at the
// source here with explicit numeric width/height matching `size`.
export function Avatar({ src, name, size = 128, alt = "", className = "" }: AvatarProps) {
  const box = { width: size, height: size };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        style={box}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{
        ...box,
        backgroundColor: MONOGRAM_BACKGROUND,
        color: MONOGRAM_FOREGROUND,
        fontSize: size * 0.34,
      }}
      className={`flex items-center justify-center rounded-full font-semibold ${className}`}
    >
      {initialsFrom(name)}
    </div>
  );
}

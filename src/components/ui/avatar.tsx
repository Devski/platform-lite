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
// source here with explicit width/height matching `size`.
//
// The side is read from --avatar-size with `size` as the fallback, so a call
// site can step the avatar down on a phone — `[--avatar-size:96px]
// sm:[--avatar-size:128px]`, set on the avatar itself or on a wrapper it
// shares with an overlay control — without rendering the image twice. A call
// site that doesn't set the variable is unaffected. The width/height
// attributes stay on `size`: they only hand the browser the 1:1 ratio before
// the stylesheet lands.
export function Avatar({ src, name, size = 128, alt = "", className = "" }: AvatarProps) {
  const side = `var(--avatar-size, ${size}px)`;
  const box = { width: side, height: side };
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
        fontSize: `calc(${side} * 0.34)`,
      }}
      className={`flex items-center justify-center rounded-full font-semibold ${className}`}
    >
      {initialsFrom(name)}
    </div>
  );
}

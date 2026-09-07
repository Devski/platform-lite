import { ImageResponse } from "next/og";
import { BrandMark, brandFont } from "./brand-mark";

// The size iOS uses when someone adds the site to their home screen.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(<BrandMark size={size.height} />, {
    ...size,
    fonts: await brandFont(),
  });
}

import { ImageResponse } from "next/og";
import { BrandMark, brandFont } from "./brand-mark";

// The browser-tab icon.

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(<BrandMark size={size.height} />, {
    ...size,
    fonts: await brandFont(),
  });
}

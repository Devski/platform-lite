import { ImageResponse } from "next/og";
import { BrandMark, brandFont } from "../brand-mark";

// The picture a chat client draws next to a shared link (WhatsApp, Signal,
// Slack, ...). Square and small on purpose: at this size those clients draw
// the compact row — title, description, thumbnail — instead of the banner
// card a wide image triggers, and a banner is the wrong shape for a mark.
//
// At the app root, not under [locale]: the mark says the same thing in both
// languages, and a /pl-prefixed address would be redirected by the locale
// middleware before a scraper ever saw the image.
export const size = { width: 128, height: 128 };
export const contentType = "image/png";
export const alt = "Architektów 3d";

export default async function OpengraphImage() {
  return new ImageResponse(<BrandMark size={size.height} />, {
    ...size,
    fonts: await brandFont(),
  });
}

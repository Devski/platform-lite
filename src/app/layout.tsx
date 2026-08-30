import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "platform-lite",
  description: "Public profiles for architecture studios and 3D artists.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}

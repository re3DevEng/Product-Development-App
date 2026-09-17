import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Product Development | re:3D",
  description:
    "Internal feature requests, engineering changes, and product roadmap. Local prototype with sample data.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

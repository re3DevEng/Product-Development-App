import type { Metadata } from "next";
import "./globals.css";
import "./brand.css";
import "./pdm.css";

export const metadata: Metadata = {
  title: "Product Development | re:3D",
  description:
    "Internal feature requests, engineering changes, and product roadmap. Local prototype with sample data.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/brand/re3d-black.png", type: "image/png" },
      {
        url: "/brand/re3d-black.png",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/brand/re3d-white.png",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try { document.documentElement.dataset.theme = localStorage.getItem('product-development-theme') === 'light' ? 'light' : 'dark'; } catch { document.documentElement.dataset.theme = 'dark'; }`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

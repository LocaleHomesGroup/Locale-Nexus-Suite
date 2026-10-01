import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/shell/Providers";
import "@/styles/globals.css";

// Locale brand type, self-hosted from the brand kit (Reference/Logos & Fonts/Fonts).
const manrope = localFont({
  src: "../src/fonts/Manrope-Variable.ttf",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});

const libre = localFont({
  src: [
    { path: "../src/fonts/LibreBaskerville-Regular.ttf", weight: "400", style: "normal" },
    { path: "../src/fonts/LibreBaskerville-Bold.ttf", weight: "700", style: "normal" },
    { path: "../src/fonts/LibreBaskerville-Italic.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-libre",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

// Monospace for IDs, job numbers and stamps — the Simple HRIS convention.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141416" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Locale Launchpad",
    template: "%s · Locale Launchpad",
  },
  description: "Locale Property Group's internal platform — one place for jobs, sales, accounts, people and knowledge.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-AU"
      className={`${manrope.variable} ${libre.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

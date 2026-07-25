import "./globals.css";
import "highlight.js/styles/github.css";

import { Inter } from "next/font/google";

import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getBrand } from "@/config/brand";

// Inter is the UI/body face per DESIGN.md ("Inter throughout"): a neutral,
// engineered sans that reads as competent infrastructure. (Cormorant Garamond was
// removed with the old split wordmark; the logo is now a single brand asset.)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export function generateMetadata(): Metadata {
  const brand = getBrand();
  return {
    title: brand.legalName,
    description: `${brand.legalName} - Omnichannel communications automation platform with AI agents and call-center tooling`,
    // Favicon comes from the brand CDN; there is no committed favicon.ico (the
    // repo ships no brand), so this is the only tab icon source.
    icons: { icon: brand.logo.favicon },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      suppressHydrationWarning
      // Product default is light (Quiet Infrastructure canvas). System can still
      // override via next-themes; pinning color-scheme avoids a pure-black FOUC
      // before the theme class hydrates on some browsers.
      className="light"
      style={{ colorScheme: "light" }}
    >
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

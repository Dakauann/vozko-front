import "./globals.css";
import "highlight.js/styles/github.css";

import { Archivo } from "next/font/google";

import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getBrand } from "@/config/brand";

/**
 * Archivo is the single UI face (Console identity).
 *
 * A grotesque with a squarer, more mechanical skeleton than the neutral sans it
 * replaces, which is what lets one family cover both registers this design
 * needs: normal width for body and data, and the `wdth` axis pushed to ~112 for
 * the small tracked caps that legend every panel. One family, per product-UI
 * practice — no display/body pairing.
 *
 * `latin-ext` is required, not optional: pt-BR, de and es all need it.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
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
      // Product default is light (the Console enamel panel). The use scene
      // decides this, not taste: Brazilian operations floors under fluorescent
      // light, full shifts, many 1366x768 laptops, text-dense queues read for
      // hours. Dark is a first-class graphite panel, not an inversion. System
      // can still override via next-themes; pinning color-scheme avoids a
      // pure-black FOUC before the theme class hydrates on some browsers.
      className="light"
      style={{ colorScheme: "light" }}
    >
      <body
        className={`${archivo.variable} font-sans antialiased bg-background text-foreground`}
      >
        {/* The direction contract, emitted as a real HTML comment so it
            survives the production build and stays auditable. A JSX comment
            would be stripped by the compiler and audit nothing. */}
        <div
          hidden
          dangerouslySetInnerHTML={{
            __html: `<!--
  THESIS: Many labeled channels, one operator, every state lit and visible. This
  surface refuses the hover-to-reveal icon rail and the floating rounded card -
  an attendant sitting eight hours should never hunt for a label or guess a state.
  OWN-WORLD: Enamel/graphite panel ground with content recessed into paper wells,
  engraved hairline rules instead of shadows, silkscreen caps legends, 2px radius
  everywhere, tabular figures on every number, and one orange lamp reserved for
  lit state and commit.
  STORY: The operator reads queue depth per channel in one glance, finds any
  conversation without hunting, and acts without leaving the strip.
  FIRST VIEWPORT: 208px full-height spine owns the top-left corner and carries the
  workspace selector at its head; a 48px header bar starts to the right of it with
  scope route left and readouts right; content sits recessed below.
  FORM: Console channel-strip, candidate 6 of the grounded list, seed 304906d6.
  FINISH: unreviewed and undocumented is unfinished; this build ends with the
  finish review, the verdict, and DESIGN.md.
-->`,
          }}
        />
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

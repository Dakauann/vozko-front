import "./globals.css";
import "highlight.js/styles/github.css";

import { Inter, Oxanium } from "next/font/google";

import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getBrand } from "@/config/brand";

/**
 * Two faces, two jobs (Vozko identity, from the brand board).
 *
 * Inter carries everything read at length — body, tables, controls — exactly
 * as the board specifies ("INTER / REGULAR: textos / informações").
 * `latin-ext` is required, not optional: pt-BR, de and es all need it.
 *
 * Oxanium is the display voice for "Títulos / Destaques": page titles, KPI
 * numerals, brand moments. It stands in for the board's literal wordmark face
 * (Orbitron), which ships no latin-ext subset and could drop to a fallback
 * mid-word in an accented title; Oxanium keeps the squared techno skeleton
 * with full locale coverage and a variable 200–800 weight range. Loaded as a
 * variable font so the weight steps cost no extra requests.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const oxanium = Oxanium({
  variable: "--font-oxanium",
  subsets: ["latin", "latin-ext"],
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
      // Product default is light. The use scene decides this, not taste:
      // Brazilian operations floors under fluorescent light, full shifts, many
      // 1366x768 laptops, text-dense queues read for hours. Dark is a
      // first-class cool-slate scene, not an inversion. System can still
      // override via next-themes; pinning color-scheme avoids a pure-black
      // FOUC before the theme class hydrates on some browsers.
      className="light"
      style={{ colorScheme: "light" }}
    >
      <body
        className={`${inter.variable} ${oxanium.variable} font-sans antialiased bg-background text-foreground`}
      >
        {/* The direction contract, emitted as a real HTML comment so it
            survives the production build and stays auditable. A JSX comment
            would be stripped by the compiler and audit nothing. */}
        <div
          hidden
          dangerouslySetInnerHTML={{
            __html: `<!--
  THESIS: The CRM that wears its own circuitry. Signal-green on graphite, a
  squared techno display voice over a workhorse body face - the Vozko brand
  board executed as a token system, not a coat of paint. It refuses the
  borrowed-cloud look it replaces (hue-17 orange on Fluent chrome) and refuses
  equally the neon-cyberpunk reading of its own board: glow is not a material
  here, contrast is.
  OWN-WORLD: #00D09A spent only on commit, selection and focus, always under
  DARK ink (9.6:1), held vivid at L38 in daylight (user call); graphite neutrals in the
  200-213 band both themes share (#0D0F10/#1A1D20/#2C3136 verbatim in dark);
  Oxanium for titles and KPI numerals, Inter at 14px for everything an
  operator reads at length; corner ramp 6/8/10/12/16; dot-matrix and circuit
  traces as the only ornament, periphery-only, token-recoloured.
  STORY: An attendant reads queue depth per channel in one glance, finds any
  conversation without hunting, and acts without leaving the strip - in an
  interface that is unmistakably this product's own.
  FIRST VIEWPORT: a full-width 48px app bar owns the top edge (brand and
  workspace at its left); the 208px nav rail starts below it; content sits on
  the canvas beside the rail. Topology is inherited unchanged from the Azure
  layout pass - the layout was never the problem.
  FORM: The user's own brand board, pinned 2026-08-23 and executed at full
  fidelity in both themes; light default is a product-truth call, dark is the
  brand-canonical scene. Seed key 00d09a7f.
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

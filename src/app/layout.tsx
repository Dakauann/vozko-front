import "./globals.css";
import "highlight.js/styles/github.css";

import { Inter } from "next/font/google";

import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getBrand } from "@/config/brand";

/**
 * Inter is the single UI face (Surface identity).
 *
 * Neither reference face can ship here — one is a system font, the other is
 * proprietary — and Inter is the closest honest stand-in for both: it is
 * effectively the register one of them sets its dashboard in, and a clean
 * substitute for the other. It replaces a grotesque with a squarer, more
 * mechanical skeleton that was chosen to serve the retired panel identity, and
 * whose small tracked caps that design depended on are gone with it.
 *
 * One family, per product-UI practice — no display/body pairing. Weight and
 * size carry the hierarchy.
 *
 * `latin-ext` is required, not optional: pt-BR, de and es all need it.
 */
const inter = Inter({
  variable: "--font-inter",
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
        className={`${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        {/* The direction contract, emitted as a real HTML comment so it
            survives the production build and stays auditable. A JSX comment
            would be stripped by the compiler and audit nothing. */}
        <div
          hidden
          dangerouslySetInnerHTML={{
            __html: `<!--
  THESIS: An operator tool that looks like the software this business runs its
  money through. This surface refuses the machined control panel it replaces -
  the engraved groove, the single flat 2px corner, the putty-beige ground and
  the stencilled caps legend - and refuses equally the soft pill-and-gradient
  shell that came before it.
  OWN-WORLD: Content sits ON a cool near-white canvas as clean white sheets,
  layered by a slate-tinted micro-shadow stack; a real corner ramp of 4/6/8/10/
  12/16px; hairline borders that compose with elevation instead of cutting into
  it; Inter at 14px; tabular figures on every number; and hue-17 orange spent
  only on commit, selection and focus.
  STORY: An attendant reads queue depth per channel in one glance, finds any
  conversation without hunting, and acts without leaving the strip - now in an
  interface a manager is willing to show a client.
  FIRST VIEWPORT: 208px full-height spine owns the top-left corner and carries
  the workspace selector at its head; a 48px header bar starts to the right of
  it with scope route left and readouts right; content sits on the canvas below.
  Topology is inherited unchanged - the layout was never the problem.
  FORM: Fluent 2 x Stripe, the category canon executed at full fidelity, pinned
  by the user rather than rolled. Seed key 7fb31c40.
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

import { getBrand } from "@/config/brand";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  useWhite?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  // Kept for API compatibility with existing callers. The brand mark is now a
  // single logo asset (no separate wordmark text), so these are ignored.
  textClassName?: string;
  hideTextOnMobile?: boolean;
}

// `sm` sits in the 48px spine head and the login sheet's title bar. At 22 it
// read as a favicon dropped into the corner rather than the mark of the
// product; 28 fills the bar the way a wordmark is supposed to.
const heightBySize = { sm: 28, md: 36, lg: 44 } as const;

/**
 * Renders the active brand's single logo (a CDN-hosted SVG). There is no more
 * split "glyph + serif text" lockup: the logo is one asset driven by brand config.
 */
export function BrandLogo({
  useWhite = false,
  size = "md",
  className,
}: BrandLogoProps) {
  const brand = getBrand();
  const height = heightBySize[size];

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external CDN SVG; next/image would require dangerouslyAllowSVG
    <img
      src={brand.logo.mark}
      alt={brand.name}
      height={height}
      style={{ height, width: "auto" }}
      className={cn(
        "inline-block object-contain",
        // The mark is a solid (black) logo. Flip it to white in dark mode; force
        // white when it sits on a dark surface regardless of theme (useWhite).
        useWhite ? "invert" : "dark:invert",
        className,
      )}
    />
  );
}

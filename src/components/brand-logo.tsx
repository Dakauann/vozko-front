import { cn } from "@/lib/utils";
import { getBrand } from "@/config/brand";

interface BrandLogoProps {
  useWhite?: boolean;
  size?: "sm" | "md" | "lg";
  /**
   * Render the square mark instead of the full wordmark.
   *
   * For narrow containers — chiefly the 52px collapsed spine rail, where the
   * wordmark is several times wider than the space it has.
   */
  square?: boolean;
  className?: string;
  // Kept for API compatibility with existing callers. The brand mark is now a
  // single logo asset (no separate wordmark text), so these are ignored.
  textClassName?: string;
  hideTextOnMobile?: boolean;
}

/*
  Sizes are the height of the VISIBLE ARTWORK, not of the file.

  That distinction is the whole reason the logo kept looking small no matter
  what number went in here. Measured from the live CDN asset:

      vozkologo_white.png   500x500 canvas, artwork 309x335
                            → fills 62% of width, 67% of height, 41% of area

  The mark is a square canvas with the artwork inset in transparent padding, so
  a nominal 40px rendered a ~27px mark and a third of the box was empty air.
  Raising the number just grew the padding along with it.

  ARTWORK_FILL divides that back out, so `sm: 40` means forty pixels of actual
  logo. The drawn box is larger than the layout box and the difference is
  absorbed by a negative margin, which keeps every surrounding bar the height it
  was designed to be.

  The real fix is upstream: `design/brand/` holds trimmed copies of both marks
  ready to replace the CDN files. Once those are live, set ARTWORK_FILL to 1.
*/
const ARTWORK_FILL = 0.67;
const heightBySize = { sm: 32, md: 40, lg: 48 } as const;

/**
 * Renders the active brand's logo (a CDN-hosted asset). There is no split
 * "glyph + serif text" lockup: the logo is one asset driven by brand config.
 *
 * The brand ships a wide wordmark AND a square favicon, and which one is right
 * depends entirely on the container. Height is fixed and width is auto — but
 * `max-width: 100%` is the load-bearing part: the logo URL comes from `BRAND_*`
 * env at build time, so its aspect ratio is unknowable here. Without that cap a
 * partner brand with a wider wordmark than the current one silently overflows
 * the spine, and nothing in this file would be wrong enough to notice.
 */
export function BrandLogo({
  useWhite = false,
  size = "md",
  square = false,
  className,
}: BrandLogoProps) {
  const brand = getBrand();
  const src = square ? brand.logo.favicon : brand.logo.mark;

  // The square favicon is drawn edge to edge, so it needs no compensation.
  const height = heightBySize[size];
  const drawn = square ? height : Math.round(height / ARTWORK_FILL);
  // Absorbed vertically so the logo occupies `height` in layout while drawing
  // at `drawn`. Without this every bar containing a logo would grow by ~50%.
  const bleed = (drawn - height) / 2;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external CDN SVG; next/image would require dangerouslyAllowSVG
    <img
      src={src}
      alt={brand.name}
      height={drawn}
      width={square ? drawn : undefined}
      style={{
        height: drawn,
        width: square ? drawn : "auto",
        maxWidth: "100%",
        marginTop: -bleed,
        marginBottom: -bleed,
      }}
      className={cn(
        "inline-block shrink-0 object-contain",
        // The mark is a solid (black) logo. Flip it to white in dark mode; force
        // white when it sits on a dark surface regardless of theme (useWhite).
        // The square favicon is full-colour artwork and must never be inverted.
        !square && (useWhite ? "invert" : "dark:invert"),
        className,
      )}
    />
  );
}

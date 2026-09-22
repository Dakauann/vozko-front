import { cn } from "@/lib/utils";
import { getBrand } from "@/config/brand";

interface BrandLogoProps {
  useWhite?: boolean;
  size?: "sm" | "md" | "lg";
  square?: boolean;
  className?: string;
  textClassName?: string;
  hideTextOnMobile?: boolean;
}

const ARTWORK_FILL = 0.67;
const heightBySize = { sm: 32, md: 40, lg: 48 } as const;

export function BrandLogo({
  useWhite = false,
  size = "md",
  square = false,
  className,
}: BrandLogoProps) {
  const brand = getBrand();
  const src = square ? brand.logo.favicon : brand.logo.mark;

  const height = heightBySize[size];
  const drawn = square ? height : Math.round(height / ARTWORK_FILL);
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
        !square && (useWhite ? "invert" : "dark:invert"),
        className,
      )}
    />
  );
}

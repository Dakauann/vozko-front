import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeBrazilianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  if (/^55\d{10,11}$/.test(digits)) {
    return digits;
  }

  if (/^\d{10,11}$/.test(digits)) {
    return `55${digits}`;
  }

  return null;
}

/**
 * Readable ink for an arbitrary solid fill (workspace labels, tags, calendar
 * events — colours the USER picks, so no token can guarantee the pair).
 * White on light hues (yellow, lime) measures under 2:1; hardcoding white was
 * producing invisible chips. Picks white or near-black by WCAG relative
 * luminance, the same way every mature label system (GitHub, Linear) does.
 * Accepts #rgb / #rrggbb; anything unparsable falls back to white, which is
 * the correct guess for the mid-to-dark colours pickers default to.
 */
export function readableInkFor(color: string | null | undefined): string {
  if (!color) return "#ffffff";
  const hex = color.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex.length === 6
        ? hex
        : null;
  if (!full || !/^[0-9a-fA-F]{6}$/.test(full)) return "#ffffff";
  const channel = (i: number) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // 0.179 is the luminance at which white and black tie on WCAG contrast.
  return luminance > 0.179 ? "#0E1113" : "#ffffff";
}

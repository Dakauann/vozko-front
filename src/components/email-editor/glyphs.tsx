"use client";

import type { ReactNode } from "react";

import type { Icon, IconProps } from "@/components/icons";

const ACCENT = "var(--icon-accent, currentColor)";

function strokeFor(size: number): number {
  const width = 27.6 / size + 0.35;
  return Math.min(2.4, Math.max(1.5, Math.round(width * 100) / 100));
}

function drawn(displayName: string, children: ReactNode): Icon {
  const Glyph: Icon = ({ size = 16, mirrored, color, style, weight, ...rest }: IconProps) => {
    void weight;
    const pixels = typeof size === "number" ? size : Number.parseFloat(size) || 16;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke={color ?? "currentColor"}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        style={{ strokeWidth: `calc(${strokeFor(pixels)} * var(--icon-stroke-scale, 1))`, ...(mirrored ? { transform: "scaleX(-1)" } : null), ...style }}
        {...rest}
      >
        {children}
      </svg>
    );
  };
  Glyph.displayName = displayName;
  return Glyph;
}

export const TextUnderline = drawn(
  "TextUnderline",
  <>
    <path stroke={ACCENT} d="M7.25 4.75v6a4.75 4.75 0 0 0 9.5 0v-6" />
    <path d="M5.75 19.25h12.5" />
  </>,
);

export const TextAlignCenter = drawn(
  "TextAlignCenter",
  <>
    <path d="M3.75 5.75h16.5M3.75 15.25h16.5" />
    <path stroke={ACCENT} d="M6.75 10.5h10.5M6.75 20h10.5" />
  </>,
);

export const TextAlignRight = drawn(
  "TextAlignRight",
  <>
    <path d="M3.75 5.75h16.5M3.75 15.25h16.5" />
    <path stroke={ACCENT} d="M9.75 10.5h10.5M9.75 20h10.5" />
  </>,
);

export const ColumnsGlyph = drawn(
  "Columns",
  <>
    <rect x="3.75" y="4.75" width="7" height="14.5" rx="1.75" />
    <rect stroke={ACCENT} x="13.25" y="4.75" width="7" height="14.5" rx="1.75" />
  </>,
);

export const ShareNetwork = drawn(
  "ShareNetwork",
  <>
    <circle cx="6.5" cy="12" r="2.25" />
    <circle stroke={ACCENT} cx="17.5" cy="6" r="2.25" />
    <circle stroke={ACCENT} cx="17.5" cy="18" r="2.25" />
    <path d="m8.5 10.9 7-3.8M8.5 13.1l7 3.8" />
  </>,
);


export const Keyboard = drawn(
  "Keyboard",
  <>
    <rect x="2.75" y="6.25" width="18.5" height="11.5" rx="2" />
    <path stroke={ACCENT} d="M8.25 14.25h7.5" />
    <path d="M6.25 9.75h.01M9.25 9.75h.01M12.25 9.75h.01M15.25 9.75h.01M18.25 9.75h.01" />
  </>,
);

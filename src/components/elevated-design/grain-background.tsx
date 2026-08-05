"use client";

import { cn } from "@/lib/utils";
import { useId } from "react";

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = {
  forest: [
    "#2e7d32",
    "#4caf50",
    "#8bc34a",
    "#cddc39",
    "#1b5e20",
    "#66bb6a",
    "#33691e",
  ],
  ocean: [
    "#1565c0",
    "#1e88e5",
    "#0288d1",
    "#0097a7",
    "#00bcd4",
    "#1a237e",
    "#42a5f5",
  ],
  aurora: [
    "#7c3aed",
    "#a855f7",
    "#c084fc",
    "#8b5cf6",
    "#6d28d9",
    "#9333ea",
    "#d946ef",
  ],
  sunset: [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#ec4899",
    "#e11d48",
    "#fb923c",
    "#dc2626",
  ],
  emerald: [
    "#10b981",
    "#14b8a6",
    "#06b6d4",
    "#0d9488",
    "#34d399",
    "#2dd4bf",
    "#059669",
  ],
  slate: [
    "#334155",
    "#475569",
    "#3b4a6b",
    "#4b5580",
    "#3a4565",
    "#4a5578",
    "#38405a",
  ],
  alert: [
    "#f97316",
    "#fb923c",
    "#f59e0b",
    "#fbbf24",
    "#facc15",
    "#000000",
    "#fef08a",
    "#fef3c7",
  ] as const,
} as const;

export type GrainPalette = keyof typeof PALETTES;

export interface ColorGroup {
  colors: string[];
  weight?: number;
}

export function createSeededGradient(
  palette: GrainPalette | string[] | ColorGroup[],
  seed: number,
): string {
  const rng = mulberry32(seed);

  let groups: ColorGroup[];

  if (typeof palette === "string") {
    const pal = [...PALETTES[palette]];
    for (let i = pal.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pal[i], pal[j]] = [pal[j], pal[i]];
    }
    const count = 4 + Math.floor(rng() * 3);
    groups = pal.slice(0, Math.min(count, pal.length)).map((c) => ({
      colors: [c],
    }));
  } else if (palette.length > 0 && typeof palette[0] === "string") {
    groups = (palette as string[]).map((c) => ({ colors: [c] }));
  } else {
    groups = palette as ColorGroup[];
  }

  const totalWeight = groups.reduce((sum, g) => sum + (g.weight ?? 1), 0);

  const blobs: string[] = [];

  for (const group of groups) {
    const weight = (group.weight ?? 1) / totalWeight;
    const anchorX = 10 + rng() * 80;
    const anchorY = 10 + rng() * 80;

    const colors = [...group.colors];
    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }

    for (const color of colors) {
      const cx = Math.max(5, Math.min(95, anchorX + (rng() - 0.5) * 40));
      const cy = Math.max(5, Math.min(95, anchorY + (rng() - 0.5) * 40));
      const baseRadius = 35 + weight * 55;
      const rx = Math.round(baseRadius + rng() * 30);
      const ry = Math.round(baseRadius + rng() * 30);

      blobs.push(
        `radial-gradient(${rx}% ${ry}% at ${cx.toFixed(0)}% ${cy.toFixed(0)}%, ${color} 0%, transparent 100%)`,
      );

      if (weight > 0.15) {
        const cx2 = Math.max(5, Math.min(95, anchorX + (rng() - 0.5) * 25));
        const cy2 = Math.max(5, Math.min(95, anchorY + (rng() - 0.5) * 25));
        const r2 = Math.round(baseRadius * 0.8 + rng() * 20);
        blobs.push(
          `radial-gradient(${r2}% ${r2}% at ${cx2.toFixed(0)}% ${cy2.toFixed(0)}%, ${color}99 0%, transparent 100%)`,
        );
      }
    }
  }

  const firstColor = groups[0]?.colors[0] ?? "#1a1a2e";
  const r = parseInt(firstColor.slice(1, 3), 16);
  const g = parseInt(firstColor.slice(3, 5), 16);
  const b = parseInt(firstColor.slice(5, 7), 16);
  const darkBase = `#${Math.round(r * 0.15)
    .toString(16)
    .padStart(2, "0")}${Math.round(g * 0.15)
    .toString(16)
    .padStart(2, "0")}${Math.round(b * 0.15)
    .toString(16)
    .padStart(2, "0")}`;
  blobs.push(darkBase);
  return blobs.join(", ");
}

function resolveIslandsColors(
  palette: GrainPalette | string[] | ColorGroup[],
): string[] {
  if (typeof palette === "string") {
    return [...PALETTES[palette]];
  }

  if (palette.length > 0 && typeof palette[0] === "string") {
    return palette as string[];
  }

  const groups = palette as ColorGroup[];
  const totalWeight = groups.reduce((s, g) => s + (g.weight ?? 1), 0);
  const expanded: string[] = [];

  for (const group of groups) {
    const groupWeight = group.weight ?? 1;
    const entryCount = Math.max(
      1,
      Math.round((groupWeight / totalWeight) * 10),
    );
    for (let i = 0; i < entryCount; i++) {
      expanded.push(group.colors[i % group.colors.length]);
    }
  }

  return expanded;
}


interface GrainBackgroundProps {
  palette: GrainPalette | string[] | ColorGroup[];
  seed?: number;
  children?: React.ReactNode;
  className?: string;
  baseFrequency?: number;
  numOctaves?: number;
  opacity?: number;
  tileSize?: number;
  type?: "fractalNoise" | "turbulence";
  warpScale?: number;
  warpFrequency?: number;
  gradient?: string;
  mode?: "blobs" | "islands";
  islandsScale?: number;
  islandsElongation?: number;
  islandsNumOctaves?: number;
  islandsWarp?: number;
  islandsBlur?: number;
}

export default function GrainBackground({
  palette = "ocean",
  seed = 42,
  children,
  className,
  baseFrequency = 0.44,
  numOctaves = 6,
  opacity = 0.6,
  tileSize = 600,
  type = "fractalNoise",
  warpScale = 120,
  warpFrequency = 0.008,
  gradient: gradientOverride,
  mode = "blobs",
  islandsScale = 0.008,
  islandsElongation = 1,
  islandsNumOctaves = 4,
  islandsWarp = 0,
  islandsBlur = 0,
}: GrainBackgroundProps) {
  const instanceId = useId().replace(/:/g, "");

  /*
    Retired as a visual device, kept as a component.

    This rendered a seeded, warped, multi-colour blob field behind its children
    — a generative gradient banner. It was already a survivor of the identity
    two designs ago, and it is decoration standing where content belongs: it
    carries no information, it fights the one accent this system has, and via
    ui/confirm-dialog.tsx it was painting a candy-coloured field behind EVERY
    confirmation dialog in the product.

    Deleting the component would mean editing its call sites and their layouts,
    which is functional churn for a visual decision. So the whole prop surface
    is still accepted and simply ignored — exactly like the icon shim — and the
    component now renders the quiet surface those call sites actually needed.
    The palettes, the seeded-gradient helper and the exported types stay exported
    so TourGuide, grain-card and the dialogs keep compiling untouched.
  */
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-muted",
        className,
      )}
    >
      {children}
    </div>
  );

  const grainSeed = seed * 3 + 37;

  const grainSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><filter id='n'><feTurbulence type='${type}' baseFrequency='${baseFrequency}' numOctaves='${numOctaves}' seed='${grainSeed}' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  const noiseUrl = `url("data:image/svg+xml,${encodeURIComponent(grainSvg)}")`;

  if (mode === "islands") {
    return renderIslands();
  }

  return renderBlobs();

  function renderBlobs() {
    const warpFilterId = `warp-${instanceId}`;
    const gradientSeed = seed;
    const warpSeed = seed * 7 + 13;

    const bg = gradientOverride ?? createSeededGradient(palette, gradientSeed);
    const overflowPx = warpScale + 40;

    return (
      <div className={cn("relative overflow-hidden rounded-2xl", className)}>
        <svg
          className="absolute"
          style={{ width: 0, height: 0 }}
          aria-hidden="true"
        >
          <defs>
            <filter
              id={warpFilterId}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency={warpFrequency}
                numOctaves={4}
                seed={warpSeed}
                stitchTiles="stitch"
                result="warpNoise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="warpNoise"
                scale={warpScale}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>

        <div
          className="absolute"
          style={{
            top: `${-overflowPx}px`,
            left: `${-overflowPx}px`,
            right: `${-overflowPx}px`,
            bottom: `${-overflowPx}px`,
            background: bg,
            filter: `url(#${warpFilterId})`,
          }}
          aria-hidden
        />

        <div
          className="absolute inset-0 mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: noiseUrl,
            backgroundRepeat: "repeat",
            backgroundSize: `${tileSize}px`,
            opacity,
          }}
          aria-hidden
        />
        <div className="relative z-10">{children}</div>
      </div>
    );
  }

  function renderIslands() {
    const islandsFilterId = `islands-${instanceId}`;
    const islandsSeed = seed * 11 + 7;
    const islandsWarpSeed = seed * 17 + 23;

    const colors = resolveIslandsColors(palette);
    const rValues = colors
      .map((c) => (parseInt(c.slice(1, 3), 16) / 255).toFixed(4))
      .join(" ");
    const gValues = colors
      .map((c) => (parseInt(c.slice(3, 5), 16) / 255).toFixed(4))
      .join(" ");
    const bValues = colors
      .map((c) => (parseInt(c.slice(5, 7), 16) / 255).toFixed(4))
      .join(" ");

    const baseFreq =
      islandsElongation === 1
        ? String(islandsScale)
        : `${islandsScale} ${islandsScale * islandsElongation}`;

    const hasWarp = islandsWarp > 0;
    const overflowPx = hasWarp ? islandsWarp + 20 : 0;

    return (
      <div className={cn("relative overflow-hidden rounded-2xl", className)}>
        <svg
          className="absolute"
          style={{ width: 0, height: 0 }}
          aria-hidden="true"
        >
          <defs>
            <filter
              id={islandsFilterId}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency={baseFreq}
                numOctaves={islandsNumOctaves}
                seed={islandsSeed}
                stitchTiles="stitch"
                result="islandsNoise"
              />
              <feColorMatrix
                type="matrix"
                in="islandsNoise"
                result="uniformNoise"
                values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1"
              />
              <feComponentTransfer in="uniformNoise" result="islandsColors">
                <feFuncR type="discrete" tableValues={rValues} />
                <feFuncG type="discrete" tableValues={gValues} />
                <feFuncB type="discrete" tableValues={bValues} />
              </feComponentTransfer>

              {islandsBlur > 0 && (
                <feGaussianBlur
                  in="islandsColors"
                  stdDeviation={islandsBlur}
                  result="blurredIslands"
                />
              )}

              {hasWarp && (
                <>
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency={warpFrequency}
                    numOctaves={3}
                    seed={islandsWarpSeed}
                    stitchTiles="stitch"
                    result="islandsWarpNoise"
                  />
                  <feDisplacementMap
                    in={islandsBlur > 0 ? "blurredIslands" : "islandsColors"}
                    in2="islandsWarpNoise"
                    scale={islandsWarp}
                    xChannelSelector="R"
                    yChannelSelector="G"
                  />
                </>
              )}
            </filter>
          </defs>
        </svg>

        <div
          className="absolute"
          style={{
            top: `${-overflowPx}px`,
            left: `${-overflowPx}px`,
            right: `${-overflowPx}px`,
            bottom: `${-overflowPx}px`,
            background: "#000",
            filter: `url(#${islandsFilterId})`,
          }}
          aria-hidden
        />

        <div
          className="absolute inset-0 mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: noiseUrl,
            backgroundRepeat: "repeat",
            backgroundSize: `${tileSize}px`,
            opacity,
          }}
          aria-hidden
        />
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
}

import { useId, type ReactNode } from "react";

import { VFX_SPECS, type VfxKind } from "@/lib/studio/vfx";
import { cn } from "@/lib/utils";

const GRAIN_DOTS: readonly [number, number][] = [
  [5, 5],
  [9, 8],
  [14, 4],
  [18, 9],
  [6, 12],
  [12, 14],
  [17, 15],
  [10, 4],
  [20, 5],
  [4, 16],
  [15, 11],
  [8, 16],
];

const PARTICLE_DOTS: readonly [number, number, number][] = [
  [6, 6, 1.4],
  [12, 4, 0.9],
  [17, 7, 1.6],
  [9, 11, 1.1],
  [15, 13, 0.8],
  [19, 14, 1.2],
  [5, 15, 0.9],
];

function drawing(kind: VfxKind, gradientId: string): ReactNode {
  switch (kind) {
    case "grain":
      return GRAIN_DOTS.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1.4" height="1.4" fill="currentColor" />);
    case "lightLeak":
      return <rect x="2" y="2" width="20" height="16" rx="2" fill={`url(#${gradientId})`} />;
    case "glitch":
      return (
        <>
          <rect x="4" y="5" width="12" height="2.5" fill="currentColor" />
          <rect x="8" y="9" width="12" height="2.5" fill="currentColor" opacity="0.7" />
          <rect x="3" y="13" width="10" height="2.5" fill="currentColor" />
        </>
      );
    case "particles":
      return PARTICLE_DOTS.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="currentColor" />);
    case "lensFlare":
      return (
        <>
          <circle cx="7" cy="6" r="3" fill={VFX_SPECS.lensFlare.colors.color} />
          <path d="M2 6h20" stroke={VFX_SPECS.lensFlare.colors.color} strokeWidth="0.8" opacity="0.8" />
          <circle cx="13" cy="11" r="1.5" fill="currentColor" opacity="0.6" />
          <circle cx="17" cy="14" r="2.2" fill="currentColor" opacity="0.4" />
        </>
      );
    case "shake":
      return (
        <>
          <rect x="6" y="5" width="12" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.45" transform="rotate(-6 12 10)" />
          <rect x="6" y="5" width="12" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" transform="rotate(5 12 10) translate(1 0)" />
        </>
      );
    case "vignette":
      return <rect x="2" y="2" width="20" height="16" rx="2" fill={`url(#${gradientId})`} />;
    case "chromaticAberration":
      return (
        <>
          <circle cx="10.5" cy="10" r="4.5" fill="none" stroke="#ff3b3b" strokeWidth="1.4" />
          <circle cx="13.5" cy="10" r="4.5" fill="none" stroke="#3b8bff" strokeWidth="1.4" />
          <circle cx="12" cy="10" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </>
      );
    default:
      return morePack(kind, gradientId);
  }
}

const MOSAIC_CELLS: readonly [number, number, number][] = [
  [4, 4, 0.9],
  [9, 4, 0.5],
  [14, 4, 0.75],
  [4, 9, 0.4],
  [9, 9, 1],
  [14, 9, 0.6],
  [4, 14, 0.7],
  [9, 14, 0.35],
  [14, 14, 0.85],
];

const SPECTRUM_BARS: readonly number[] = [5, 9, 12, 8, 10, 6, 4];

function morePack(kind: VfxKind, gradientId: string): ReactNode {
  switch (kind) {
    case "glow":
      return (
        <>
          <circle cx="12" cy="10" r="6" fill={`url(#${gradientId})`} />
          <circle cx="12" cy="10" r="2.5" fill="currentColor" />
        </>
      );
    case "mosaic":
      return MOSAIC_CELLS.map(([x, y, opacity]) => <rect key={`${x}-${y}`} x={x + 1} y={y - 1} width="4.5" height="4.5" fill="currentColor" opacity={opacity} />);
    case "posterize":
      return [0, 1, 2, 3].map((step) => <rect key={step} x={4 + step * 4} y="5" width="4" height="10" fill="currentColor" opacity={0.25 + step * 0.25} />);
    case "mirror":
      return (
        <>
          <path d="M12 3v14" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 1" />
          <path d="M10 6l-5 4 5 4z" fill="currentColor" />
          <path d="M14 6l5 4-5 4z" fill="currentColor" opacity="0.45" />
        </>
      );
    case "offset":
      return (
        <>
          <rect x="13" y="5" width="9" height="10" fill="currentColor" />
          <rect x="2" y="5" width="5" height="10" fill="currentColor" opacity="0.6" />
          <path d="M7.5 10h4" stroke="currentColor" strokeWidth="1" />
        </>
      );
    case "directionalBlur":
      return [0, 1, 2].map((row) => <path key={row} d={`M${4 + row * 2} ${6 + row * 4}h${12 - row * 2}`} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity={1 - row * 0.25} />);
    case "zoomBlur":
      return [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <path key={angle} d="M15 10h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" transform={`rotate(${angle} 12 10)`} />
      ));
    case "spinBlur":
      return (
        <>
          <path d="M12 4a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M12 16a6 6 0 0 1-6-6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M12 7a3 3 0 0 1 3 3" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        </>
      );
    case "waveWarp":
      return [0, 1].map((row) => <path key={row} d={`M3 ${7 + row * 6}q3-3 6 0t6 0t6 0`} fill="none" stroke="currentColor" strokeWidth="1.4" />);
    case "ripple":
      return [2, 4.5, 7].map((r) => <circle key={r} cx="12" cy="10" r={r} fill="none" stroke="currentColor" strokeWidth="1" opacity={1 - r / 10} />);
    case "twirl":
      return <path d="M12 10m-1 0a1 1 0 1 1 2 0a2.5 2.5 0 1 1-5 0a4 4 0 1 1 8 0a5.5 5.5 0 1 1-11 0" fill="none" stroke="currentColor" strokeWidth="1.2" />;
    case "bulge":
      return (
        <>
          <path d="M3 6q9 -4 18 0M3 14q9 4 18 0M8 3q-4 7 0 14M16 3q4 7 0 14" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="12" cy="10" r="2" fill="currentColor" />
        </>
      );
    case "cornerPin":
      return (
        <>
          <path d="M5 5L19 7L17 16L4 14Z" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1" />
          {[
            [5, 5],
            [19, 7],
            [17, 16],
            [4, 14],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor" />
          ))}
        </>
      );
    case "fractalNoise":
      return <rect x="2" y="2" width="20" height="16" rx="2" fill={`url(#${gradientId})`} />;
    case "gradientRamp":
      return <rect x="2" y="2" width="20" height="16" rx="2" fill={`url(#${gradientId})`} />;
    case "fourColorGradient":
      return (
        <>
          <rect x="2" y="2" width="10" height="8" fill={VFX_SPECS.fourColorGradient.colors.color} opacity="0.85" />
          <rect x="12" y="2" width="10" height="8" fill={VFX_SPECS.fourColorGradient.colors.color2} opacity="0.85" />
          <rect x="12" y="10" width="10" height="8" fill={VFX_SPECS.fourColorGradient.colors.color3} opacity="0.85" />
          <rect x="2" y="10" width="10" height="8" fill={VFX_SPECS.fourColorGradient.colors.color4} opacity="0.85" />
        </>
      );
    case "audioSpectrum":
      return SPECTRUM_BARS.map((height, i) => <rect key={i} x={3.5 + i * 2.5} y={16 - height} width="1.6" height={height} rx="0.8" fill="currentColor" />);
    case "audioWaveform":
      return SPECTRUM_BARS.map((height, i) => <rect key={i} x={3.5 + i * 2.5} y={10 - height / 2} width="1.6" height={height} rx="0.8" fill="currentColor" />);
    case "posterizeTime":
      return [0, 1, 2].map((step) => <rect key={step} x={4 + step * 6} y={12 - step * 3} width="4" height="4" fill="currentColor" opacity={0.4 + step * 0.3} />);
    case "echo":
      return [0, 1, 2].map((step) => <circle key={step} cx={7 + step * 4} cy="10" r="3.5" fill="currentColor" opacity={0.25 + step * 0.35} />);
    default:
      return null;
  }
}

function gradient(kind: VfxKind, id: string): ReactNode {
  if (kind === "lightLeak") {
    return (
      <radialGradient id={id} cx="0.2" cy="0.25" r="0.9">
        <stop offset="0" stopColor={VFX_SPECS.lightLeak.colors.color} />
        <stop offset="0.5" stopColor={VFX_SPECS.lightLeak.colors.color2} stopOpacity="0.6" />
        <stop offset="1" stopColor={VFX_SPECS.lightLeak.colors.color2} stopOpacity="0" />
      </radialGradient>
    );
  }
  if (kind === "vignette") {
    return (
      <radialGradient id={id} cx="0.5" cy="0.5" r="0.7">
        <stop offset="0.45" stopColor="currentColor" stopOpacity="0" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0.9" />
      </radialGradient>
    );
  }
  if (kind === "glow") {
    return (
      <radialGradient id={id} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0.3" stopColor="currentColor" stopOpacity="0.8" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
    );
  }
  if (kind === "gradientRamp") {
    return (
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="currentColor" stopOpacity="0.1" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0.9" />
      </linearGradient>
    );
  }
  if (kind === "fractalNoise") {
    return (
      <radialGradient id={id} cx="0.3" cy="0.4" r="0.8">
        <stop offset="0" stopColor="currentColor" stopOpacity="0.85" />
        <stop offset="0.4" stopColor="currentColor" stopOpacity="0.25" />
        <stop offset="0.7" stopColor="currentColor" stopOpacity="0.6" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0.15" />
      </radialGradient>
    );
  }
  return null;
}

export function VfxGlyph({ kind, className }: { kind: VfxKind; className?: string }) {
  const gradientId = `vfx${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 24 20" aria-hidden className={cn("h-5 w-6", className)}>
      <defs>{gradient(kind, gradientId)}</defs>
      <rect x="2" y="2" width="20" height="16" rx="2" fill="currentColor" opacity="0.15" />
      {drawing(kind, gradientId)}
    </svg>
  );
}

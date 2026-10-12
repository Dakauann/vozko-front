import type { TransitionKind } from "@/lib/studio/transitions";
import { cn } from "@/lib/utils";

const INCOMING: Record<TransitionKind, string> = {
  dissolve: "M2 2h20v16H2z",
  dipToColor: "M12 2h10v16H12z",
  push: "M12 2h10v16H12z",
  slide: "M10 2h12v16H10z",
  wipe: "M2 2h9v16H2z",
  iris: "M12 4a6 6 0 1 1 0 12a6 6 0 1 1 0-12z",
  clockWipe: "M12 10V2h10v16H12z",
  split: "M8 2h8v16H8z",
  zoom: "M7 5h10v10H7z",
  whip: "M14 2h8v16h-8z",
  blurDissolve: "M2 2h20v16H2z",
  gradientWipe: "M2 2h5v16H2zM8 2h3v16H8zM12 2h2v16h-2zM15 2h1v16h-1z",
  venetianBlinds: "M2 2h20v2.5H2zM2 6.5h20V9H2zM2 11h20v2.5H2zM2 15.5h20V18H2z",
  blockDissolve: "M2 2h4v4H2zM10 2h4v4h-4zM6 6h4v4H6zM18 6h4v4h-4zM2 10h4v4H2zM14 10h4v4h-4zM10 14h4v4h-4zM18 14h4v4h-4z",
  radialWipe: "M12 18L4.5 2h15z",
  constantPower: "M2 18C8 18 10 2 22 2v16z",
  constantGain: "M2 18L22 2v16z",
};

export function TransitionPreview({ kind, src, mode }: { kind: TransitionKind; src: string | undefined; mode: "cut" | "edge" }) {
  if (!src) return <TransitionGlyph kind={kind} />;
  return <span aria-hidden data-studio-transition-preview={`${mode}:${kind}`} className="aspect-video w-full rounded-[calc(var(--radius)-2px)] bg-cover bg-center" style={{ backgroundImage: `url(${src})` }} />;
}

export function TransitionGlyph({ kind, className }: { kind: TransitionKind; className?: string }) {
  const faded = kind === "dissolve" || kind === "blurDissolve";
  return (
    <svg viewBox="0 0 24 20" aria-hidden className={cn("h-5 w-6", className)}>
      <rect x="2" y="2" width="20" height="16" rx="2" fill="currentColor" opacity="0.25" />
      <path d={INCOMING[kind]} fill="currentColor" opacity={faded ? 0.6 : 0.9} />
      {kind === "dipToColor" ? <rect x="2" y="2" width="10" height="16" fill="currentColor" opacity="0.5" /> : null}
    </svg>
  );
}

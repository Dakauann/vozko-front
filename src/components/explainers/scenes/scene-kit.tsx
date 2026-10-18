import type { CSSProperties, ReactNode } from "react";

import type { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type SceneTone = "neutral" | "accent" | "warning" | "danger" | "muted";

const TILE_TONE: Record<SceneTone, string> = {
  neutral: "border-border bg-card text-foreground",
  accent: "border-primary bg-primary text-primary-foreground",
  warning: "border-warning bg-card text-warning-ink",
  danger: "border-destructive bg-card text-destructive-ink",
  muted: "border-dashed border-border-strong bg-transparent text-muted-foreground",
};

export const stagger = (index: number): CSSProperties => ({ animationDelay: `${index * 0.18}s` });

export function SceneTile({
  icon: Glyph,
  label,
  tone = "neutral",
  index,
  size = "md",
}: {
  icon: Icon;
  label?: string;
  tone?: SceneTone;
  index: number;
  size?: "sm" | "md";
}) {
  return (
    <div className="vz-wave-pop flex min-w-0 flex-col items-center gap-1.5" style={stagger(index)}>
      <span className={cn("flex items-center justify-center border shadow-sm", size === "md" ? "h-11 w-11 rounded-xl" : "h-8 w-8 rounded-lg", TILE_TONE[tone])}>
        <Glyph className={size === "md" ? "h-5 w-5" : "h-4 w-4"} weight={tone === "accent" ? "fill" : "regular"} />
      </span>
      {label ? <span className="max-w-[6rem] text-center text-2xs font-medium leading-tight text-muted-foreground">{label}</span> : null}
    </div>
  );
}

export function SceneConnector({ index, className }: { index: number; className?: string }) {
  return <span aria-hidden className={cn("vz-flow-line vz-wave-pop h-[1.5px] min-w-4 flex-1", className)} style={stagger(index)} />;
}

export function SceneFrame({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="img" aria-label={label} className={cn("px-4 pb-3 pt-4", className)}>
      {children}
    </div>
  );
}

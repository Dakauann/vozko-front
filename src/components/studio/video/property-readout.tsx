import { canvasAspect, type Clip } from "@/lib/studio/document";
import { morphValue, paintValue, pathPoint, propertyValue } from "@/lib/studio/keyframe-edit";
import { isColorProperty, isPathProperty, type AnimatedProperty, type KeyframeProperty } from "@/lib/studio/keyframes";
import { isMorphProperty } from "@/lib/studio/morph-keys";
import { isLineProperty } from "@/lib/studio/line-properties";
import { counterText } from "@/lib/studio/counter";
import { cn } from "@/lib/utils";

import { useEditorState } from "./editor-context";
import { formatLineValue } from "./line-units";

export function formatValue(property: KeyframeProperty, value: number): string {
  if (isLineProperty(property)) return formatLineValue(property, value);
  if (property === "rotation") return `${value.toFixed(1)}°`;
  if (property === "blur") return `${value.toFixed(1)} px`;
  if (property === "gainDb") return `${value.toFixed(1)} dB`;
  return `${(value * 100).toFixed(1)}%`;
}

function PathReadout({ clip, localMs, className }: { clip: Clip; localMs: number; className?: string }) {
  const aspect = useEditorState((s) => canvasAspect(s.document));
  const point = pathPoint(clip, localMs, aspect);
  return <span className={cn("font-mono tabular-nums", className)}>{`${(point.x * 100).toFixed(0)}, ${(point.y * 100).toFixed(0)}%`}</span>;
}

function MorphReadout({ clip, localMs, className }: { clip: Clip; localMs: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center justify-end", className)}>
      <svg aria-hidden viewBox="-0.1 -0.1 1.2 1.2" className="h-3 w-3 overflow-visible text-foreground">
        <path d={morphValue(clip, localMs)} fill="currentColor" fillOpacity={0.35} stroke="currentColor" strokeWidth={0.08} />
      </svg>
    </span>
  );
}

export function PropertyReadout({ clip, property, localMs, className }: { clip: Clip; property: AnimatedProperty; localMs: number; className?: string }) {
  if (isMorphProperty(property)) return <MorphReadout clip={clip} localMs={localMs} className={className} />;
  if (isPathProperty(property)) return <PathReadout clip={clip} localMs={localMs} className={className} />;
  if (isColorProperty(property)) {
    const color = paintValue(clip, property, localMs);
    return (
      <span className={cn("inline-flex items-center justify-end gap-1 font-mono tabular-nums", className)}>
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-border" style={{ background: color }} />
        {color.toUpperCase()}
      </span>
    );
  }
  const value = propertyValue(clip, property, localMs);
  const text = property === "counter" && clip.counter ? counterText(clip.counter, value) : formatValue(property, value);
  return <span className={cn("font-mono tabular-nums", className)}>{text}</span>;
}

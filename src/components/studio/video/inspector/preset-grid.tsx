"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { animatedTransform } from "@/lib/studio/keyframes";
import { KEYFRAME_PRESETS, presetKeyframes, type KeyframePresetId } from "@/lib/studio/keyframe-presets";
import { boxStyle } from "@/lib/studio/playback";
import { cn } from "@/lib/utils";

const SAMPLE = { transform: { x: 0.5, y: 0.5, w: 0.34, h: 0.34, rotation: 0, opacity: 1 }, durationMs: 1600 };
const SAMPLE_KEYS = Object.fromEntries(KEYFRAME_PRESETS.map((id) => [id, presetKeyframes(id, SAMPLE)])) as Record<KeyframePresetId, ReturnType<typeof presetKeyframes>>;
const REST_MS = SAMPLE.durationMs / 2;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function PresetThumb({ id, playing }: { id: KeyframePresetId; playing: boolean }) {
  const [atMs, setAtMs] = useState(REST_MS);
  const frame = useRef<number | null>(null);

  const animating = playing && !reducedMotion();

  useEffect(() => {
    if (!animating) return;
    const started = performance.now();
    const tick = (now: number) => {
      setAtMs((now - started) % SAMPLE.durationMs);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [animating]);

  const transform = animatedTransform(SAMPLE.transform, SAMPLE_KEYS[id], animating ? atMs : REST_MS);
  return (
    <span aria-hidden className="relative block h-8 w-full overflow-hidden rounded-sm border border-border bg-muted">
      <span className="absolute rounded-[2px] bg-foreground" style={boxStyle({ transform, opacity: transform.opacity, trackIndex: 0 })} />
    </span>
  );
}

interface PresetGridProps {
  disabled: boolean;
  onApply: (id: KeyframePresetId) => void;
}

export function PresetGrid({ disabled, onApply }: PresetGridProps) {
  const t = useTranslations("studio.video.keyframes");
  const [hovered, setHovered] = useState<KeyframePresetId | null>(null);
  return (
    <div className="space-y-1">
      <span className="block text-2xs text-muted-foreground">{t("presetsTitle")}</span>
      <div role="group" aria-label={t("presetsTitle")} className="grid grid-cols-4 gap-1">
        {KEYFRAME_PRESETS.map((id) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            title={t("presetApply", { name: t(`presets.${id}`) })}
            onPointerEnter={() => setHovered(id)}
            onPointerLeave={() => setHovered((current) => (current === id ? null : current))}
            onFocus={() => setHovered(id)}
            onBlur={() => setHovered((current) => (current === id ? null : current))}
            onClick={() => onApply(id)}
            className={cn(
              "flex min-w-0 flex-col gap-1 rounded-[--radius] border border-border bg-card p-1 text-left text-[10px] leading-tight text-foreground transition-colors",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <PresetThumb id={id} playing={hovered === id} />
            <span className="line-clamp-2 block min-h-[2lh] break-words">{t(`presets.${id}`)}</span>
          </button>
        ))}
      </div>
      <p className="text-2xs text-muted-foreground">{t("presetHint")}</p>
    </div>
  );
}

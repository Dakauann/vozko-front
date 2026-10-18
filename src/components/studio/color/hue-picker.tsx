"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";

import { HUE_CENTERS, HUE_NAMES, type HueSecondary } from "@/lib/studio/hue-secondary";
import { cn } from "@/lib/utils";

const TURN = 360;
const BIG_STEP = 10;
const SPECTRUM = `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) => `hsl(${i * 30} 90% 50%)`).join(", ")})`;

interface HuePickerProps {
  secondary: HueSecondary;
  disabled: boolean;
  onChange: (next: HueSecondary) => void;
  onStart: () => void;
  onEnd: () => void;
}

function wrapped(hue: number): number {
  return Math.round(((hue % TURN) + TURN) % TURN);
}

export function HuePicker({ secondary, disabled, onChange, onStart, onEnd }: HuePickerProps) {
  const t = useTranslations("studio.color.hsl");
  const strip = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const left = secondary.hue - secondary.width / 2;
  const soft = secondary.softness ?? 0;

  const hueAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = strip.current!.getBoundingClientRect();
    return wrapped(((event.clientX - rect.left) / rect.width) * TURN);
  };

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = event.shiftKey ? BIG_STEP : 1;
    const delta = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    onStart();
    onChange({ ...secondary, hue: wrapped(secondary.hue + delta) });
    onEnd();
  };

  return (
    <div className="space-y-2">
      <div
        ref={strip}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={t("hue")}
        aria-valuemin={0}
        aria-valuemax={TURN}
        aria-valuenow={secondary.hue}
        aria-valuetext={t("hueValue", { hue: secondary.hue })}
        aria-disabled={disabled}
        className={cn("relative h-7 w-full touch-none overflow-hidden rounded-[--radius] border border-control-edge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", disabled ? "opacity-60" : "cursor-pointer")}
        style={{ background: SPECTRUM }}
        onKeyDown={keys}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return;
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          onStart();
          onChange({ ...secondary, hue: hueAt(event) });
        }}
        onPointerMove={(event) => {
          if (dragging.current) onChange({ ...secondary, hue: hueAt(event) });
        }}
        onPointerUp={() => {
          if (!dragging.current) return;
          dragging.current = false;
          onEnd();
        }}
      >
        {[-TURN, 0, TURN].map((offset) => (
          <div key={offset} aria-hidden className="pointer-events-none absolute inset-y-0" style={{ left: `${((left - soft + offset) / TURN) * 100}%`, width: `${((secondary.width + 2 * soft) / TURN) * 100}%` }}>
            <div className="absolute inset-y-0 border-y-2 border-white/60" style={{ left: `${(soft / (secondary.width + 2 * soft || 1)) * 100}%`, right: `${(soft / (secondary.width + 2 * soft || 1)) * 100}%`, boxShadow: "0 0 0 1px rgba(0,0,0,0.5) inset" }} />
          </div>
        ))}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]" style={{ left: `${(secondary.hue / TURN) * 100}%` }} />
      </div>
      <div role="group" aria-label={t("colors")} className="flex flex-wrap gap-1">
        {HUE_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            disabled={disabled}
            aria-pressed={secondary.hue === HUE_CENTERS[name]}
            title={t(`colorNames.${name}`)}
            aria-label={t(`colorNames.${name}`)}
            onClick={() => {
              onStart();
              onChange({ ...secondary, hue: HUE_CENTERS[name] });
              onEnd();
            }}
            className={cn("h-6 w-6 rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", secondary.hue === HUE_CENTERS[name] ? "scale-110 border-foreground" : "border-transparent")}
            style={{ background: `hsl(${HUE_CENTERS[name]} 85% 50%)` }}
          />
        ))}
      </div>
    </div>
  );
}

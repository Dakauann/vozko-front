"use client";

import { STUDIO_ICONS, STUDIO_ICON_IDS } from "@/components/studio/canvas/icon-catalog";
import { cn } from "@/lib/utils";

export function iconLabel(iconId: string): string {
  return iconId.replace(/-logo$/, "").replace(/-/g, " ");
}

interface IconGridProps {
  label: string;
  value?: string;
  onPick: (iconId: string) => void;
  disabled?: boolean;
}

export function IconGrid({ label, value, onPick, disabled }: IconGridProps) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-6 gap-1">
      {STUDIO_ICON_IDS.map((id) => {
        const Glyph = STUDIO_ICONS[id];
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-label={iconLabel(id)}
            aria-pressed={value === undefined ? undefined : value === id}
            title={iconLabel(id)}
            onClick={() => onPick(id)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md border border-transparent text-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
              value === id && "border-primary-edge bg-primary text-primary-foreground hover:bg-primary-hover",
            )}
          >
            <Glyph className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

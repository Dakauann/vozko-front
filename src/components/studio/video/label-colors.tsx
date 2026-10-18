"use client";

import { useTranslations } from "next-intl";

import { LABEL_COLORS, type LabelColor } from "@/lib/studio/labels";
import { cn } from "@/lib/utils";

const LABEL_HEX: Record<LabelColor, string> = {
  red: "#e5484d",
  orange: "#f76b15",
  yellow: "#f5c518",
  green: "#30a46c",
  cyan: "#05a2c2",
  blue: "#3e63dd",
  purple: "#8e4ec6",
  pink: "#d6409f",
};

export function labelHex(color: LabelColor | undefined): string | undefined {
  return color ? LABEL_HEX[color] : undefined;
}

export function LabelSwatch({ color, className }: { color: LabelColor | undefined; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full border", color ? "border-transparent" : "border-dashed border-muted-foreground", className)}
      style={color ? { background: LABEL_HEX[color] } : undefined}
    />
  );
}

export function useLabelName(): (color: LabelColor | undefined) => string {
  const t = useTranslations("studio.video.organize.colors");
  return (color) => t(color ?? "none");
}

interface LabelColorPickerProps {
  label: string;
  value: LabelColor | undefined | null;
  disabled?: boolean;
  onChange: (color: LabelColor | undefined) => void;
}

export function LabelColorPicker({ label, value, disabled, onChange }: LabelColorPickerProps) {
  const name = useLabelName();
  const options: (LabelColor | undefined)[] = [undefined, ...LABEL_COLORS];
  return (
    <div className="space-y-1">
      <span className="block text-2xs text-muted-foreground">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((color) => {
          const selected = value !== null && value === color;
          return (
            <button
              key={color ?? "none"}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name(color)}
              title={name(color)}
              disabled={disabled}
              onClick={() => onChange(color)}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-[--radius] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                selected ? "border-foreground bg-muted" : "border-transparent hover:bg-muted",
              )}
            >
              <LabelSwatch color={color} className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

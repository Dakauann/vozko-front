"use client";

import { useTranslations } from "next-intl";

import { CurrencyDollar, Eye, ImageSquare, Lightbulb, Microphone, Stack, Tag, Wrench, X, type Icon } from "@/components/icons";
import type { ModelCapability } from "@/lib/ai-models/capabilities";
import { cn } from "@/lib/utils";

const CAPABILITY_ICONS: Record<ModelCapability, Icon> = {
  vision: Eye,
  tools: Wrench,
  reasoning: Lightbulb,
  long_context: Stack,
  image_output: ImageSquare,
  audio_input: Microphone,
  low_price: CurrencyDollar,
  free: Tag,
};

export function CapabilityIcons({ capabilities, className }: { capabilities: readonly ModelCapability[]; className?: string }) {
  const t = useTranslations("modelPicker");
  if (capabilities.length === 0) return null;
  return (
    <span className={cn("flex items-center gap-1 text-muted-foreground", className)}>
      {capabilities.map((capability) => {
        const Glyph = CAPABILITY_ICONS[capability];
        return (
          <span key={capability} role="img" aria-label={t(`capabilities.${capability}`)} title={t(`capabilityHints.${capability}`)} className="inline-flex">
            <Glyph className="h-3.5 w-3.5" aria-hidden />
          </span>
        );
      })}
    </span>
  );
}

const CHIP =
  "inline-flex h-7 flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors duration-DEFAULT focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CapabilityFilterChips({
  offered,
  active,
  onToggle,
  onClear,
}: {
  offered: readonly ModelCapability[];
  active: readonly ModelCapability[];
  onToggle: (capability: ModelCapability) => void;
  onClear: () => void;
}) {
  const t = useTranslations("modelPicker");
  if (offered.length === 0) return null;
  return (
    <div role="group" aria-label={t("filters.label")} className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
      {offered.map((capability) => {
        const Glyph = CAPABILITY_ICONS[capability];
        const pressed = active.includes(capability);
        return (
          <button
            key={capability}
            type="button"
            aria-pressed={pressed}
            title={t(`capabilityHints.${capability}`)}
            onClick={() => onToggle(capability)}
            className={cn(
              CHIP,
              pressed ? "border-primary/40 bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Glyph className="h-3.5 w-3.5" aria-hidden />
            {t(`capabilities.${capability}`)}
          </button>
        );
      })}
      {active.length > 0 ? (
        <button type="button" onClick={onClear} className={cn(CHIP, "border-transparent text-muted-foreground hover:text-foreground")}>
          <X className="h-3 w-3" aria-hidden />
          {t("filters.clear")}
        </button>
      ) : null}
    </div>
  );
}

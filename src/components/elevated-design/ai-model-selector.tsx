"use client";

import { useMemo, useState } from "react";
import { CaretRight } from "@phosphor-icons/react";

import { ModelPickerSheet } from "./model-picker-sheet";
import { ModelBrandIcon } from "./model-brand-icon";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { cn } from "@/lib/utils";
import { softSurfaceWithInset } from "./shadow-presets";

const DISABLED_SHADOW =
  "0 12px 24px -20px rgba(15,23,42,0.12), inset 0 1px 0 var(--shadow-highlight)";

function formatPrice(price: number): string {
  if (!price || price <= 0) return "Grátis";
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

function getModelDisplayName(modelId: string, fallbackName?: string): string {
  if (fallbackName && fallbackName.trim()) return fallbackName;
  const parts = modelId.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : modelId;
}

interface AIModelSelectorProps {
  label?: string;
  value?: string | null;
  onValueChange?: (value: string) => void;
  models: string[];
  modelPricing?: ModelPricingInfo[];
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

export function AIModelSelector({
  label = "Modelo de IA",
  value,
  onValueChange,
  models,
  modelPricing,
  disabled,
  searchPlaceholder = "Pesquisar modelo ou provedor...",
  emptyMessage = "Nenhum modelo encontrado",
  className,
}: AIModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  const pricing = useMemo(() => {
    if (!value || !modelPricing) return undefined;
    return modelPricing.find((p) => p.id === value);
  }, [modelPricing, value]);

  const hasSelection = Boolean(value);
  const floatingState = focused || open || hasSelection;
  const priceLabel =
    pricing && (pricing.promptPrice > 0 || pricing.completionPrice > 0)
      ? `${formatPrice(pricing.promptPrice)} · ${formatPrice(pricing.completionPrice)} /M`
      : null;

  return (
    <div className={cn("relative w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-full border border-border bg-card px-5 py-3 text-left text-sm font-medium text-foreground transition-all duration-200 ease-out",
          "hover:border-foreground/20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60",
        )}
        style={{
          boxShadow: disabled ? DISABLED_SHADOW : softSurfaceWithInset,
        }}
      >
        <span className="flex min-h-[1.25rem] min-w-0 flex-1 items-center gap-2 text-sm text-foreground">
          {value ? (
            <>
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                <ModelBrandIcon modelId={value} size={16} />
              </span>
              <span className="truncate font-medium text-foreground">
                {getModelDisplayName(value, pricing?.name)}
              </span>
              {priceLabel ? (
                <span className="ml-auto flex-shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
                  {priceLabel}
                </span>
              ) : null}
            </>
          ) : null}
        </span>
        <CaretRight
          className="h-4 w-4 flex-shrink-0 text-muted-foreground"
          weight="bold"
        />
      </button>

      {label ? (
        <label
          className={cn(
            "pointer-events-none absolute rounded-full px-2 py-[2px] text-sm font-medium transition-all duration-200 ease-out",
            "left-5",
            floatingState
              ? cn(
                  "-ml-1 top-0 -translate-y-1/2 text-[11px] shadow-sm",
                  disabled
                    ? "bg-muted text-muted-foreground"
                    : "bg-card text-foreground",
                )
              : "top-1/2 -translate-y-1/2 text-muted-foreground",
          )}
          style={{ transformOrigin: "left center" }}
        >
          {label}
        </label>
      ) : null}

      <ModelPickerSheet
        open={open}
        onOpenChange={setOpen}
        value={value}
        onValueChange={(val) => onValueChange?.(val)}
        models={models}
        modelPricing={modelPricing}
        title={label}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}

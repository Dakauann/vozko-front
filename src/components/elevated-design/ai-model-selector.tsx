"use client";

import { useMemo, useState } from "react";
import { CaretRight } from "@/components/icons";

import { ModelPickerSheet } from "./model-picker-sheet";
import { ModelBrandIcon } from "./model-brand-icon";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { cn } from "@/lib/utils";
import { softSurfaceWithInset } from "./shadow-presets";

const DISABLED_SHADOW =
  "inset 0 1px 0 hsl(var(--rule-strong)), 0 1px 0 hsl(var(--card) / 0.6)";

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
  const priceLabel =
    pricing && (pricing.promptPrice > 0 || pricing.completionPrice > 0)
      ? `${formatPrice(pricing.promptPrice)} · ${formatPrice(pricing.completionPrice)} /M`
      : null;

  return (
    /*
      Legend over a sunk field.

      This was a Material-style floating label that animated up and punched a
      gap through the control's own border. That device belongs to a different
      system entirely; here a control is legended on the panel above it, the
      label holds still, and the field reads as a recess rather than an outline
      with a hole in it.
    */
    <div className={cn("w-full", className)}>
      {label ? (
        <span className="legend mb-1 block">{label}</span>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-[--radius] border border-border border-t-rule-strong bg-muted px-2.5 py-1.5 text-left text-[13px] font-medium text-foreground transition-colors",
          "hover:border-rule-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

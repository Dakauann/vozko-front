"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Brain, Check } from "@/components/icons";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "./elevated-sheet";
import {
  ModelBrandIcon,
  getModelProviderLabel,
  getModelProviderSlug,
} from "./model-brand-icon";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { cn } from "@/lib/utils";

const NEW_MODEL_WINDOW_DAYS = 30;

function formatPrice(price: number): string {
  if (!price || price <= 0) return "Grátis";
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

function formatContext(tokens?: number): string | null {
  if (!tokens || tokens <= 0) return null;
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return `${tokens}`;
}

function getModelDisplayName(modelId: string, fallbackName?: string): string {
  if (fallbackName && fallbackName.trim()) return fallbackName;
  const parts = modelId.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : modelId;
}

type ModelEntry = {
  id: string;
  name: string;
  providerSlug: string;
  providerLabel: string;
  promptPrice: number;
  completionPrice: number;
  contextLabel: string | null;
  isNew: boolean;
};

type ModelGroup = {
  slug: string;
  label: string;
  models: ModelEntry[];
};

export interface ModelPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: string | null;
  onValueChange?: (value: string) => void;
  models: string[];
  modelPricing?: ModelPricingInfo[];
  title?: string;
  description?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export function ModelPickerSheet({
  open,
  onOpenChange,
  value,
  onValueChange,
  models,
  modelPricing,
  title = "Selecionar modelo",
  description,
  searchPlaceholder = "Pesquisar modelo ou provedor...",
  emptyMessage = "Nenhum modelo encontrado",
}: ModelPickerSheetProps) {
  // Captured once at mount via a lazy initializer (keeps render pure). A 30-day
  // "New" window doesn't need sub-session precision, so a per-mount clock is fine.
  const [nowSeconds] = useState(() => Date.now() / 1000);

  const groups = useMemo<ModelGroup[]>(() => {
    const pricingMap = new Map<string, ModelPricingInfo>();
    for (const p of modelPricing ?? []) pricingMap.set(p.id, p);

    const newThreshold = nowSeconds - NEW_MODEL_WINDOW_DAYS * 24 * 60 * 60;

    // `models` arrives in OpenRouter most-popular order. We group by provider on
    // first appearance, so the most-popular provider leads and rows stay ranked
    // within each group.
    const order: string[] = [];
    const byProvider = new Map<string, ModelGroup>();

    for (const id of models) {
      const pricing = pricingMap.get(id);
      const slug = getModelProviderSlug(id);
      let group = byProvider.get(slug);
      if (!group) {
        group = { slug, label: getModelProviderLabel(id), models: [] };
        byProvider.set(slug, group);
        order.push(slug);
      }
      group.models.push({
        id,
        name: getModelDisplayName(id, pricing?.name),
        providerSlug: slug,
        providerLabel: group.label,
        promptPrice: pricing?.promptPrice ?? 0,
        completionPrice: pricing?.completionPrice ?? 0,
        contextLabel: formatContext(pricing?.contextLength),
        isNew: Boolean(pricing?.created && pricing.created >= newThreshold),
      });
    }

    return order.map((slug) => byProvider.get(slug)!);
  }, [models, modelPricing, nowSeconds]);

  const totalCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.models.length, 0),
    [groups],
  );

  const resolvedDescription =
    description ??
    (totalCount > 0
      ? `${totalCount} modelos · ordenados por popularidade`
      : "Nenhum modelo disponível");

  const handleSelect = (id: string) => {
    onValueChange?.(id);
    onOpenChange(false);
  };

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-md motion-reduce:!animate-none motion-reduce:!transition-none"
      >
        <ElevatedSheetHeader className="gap-3 pr-16">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[--radius] bg-primary text-white shadow-sm">
              <Brain weight="fill" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <ElevatedSheetTitle className="truncate text-lg">
                {title}
              </ElevatedSheetTitle>
              {resolvedDescription ? (
                <ElevatedSheetDescription className="truncate">
                  {resolvedDescription}
                </ElevatedSheetDescription>
              ) : null}
            </div>
          </div>
        </ElevatedSheetHeader>

        <Command className="flex min-h-0 flex-1 flex-col rounded-none border-0 bg-transparent shadow-none">
          <CommandInput placeholder={searchPlaceholder} className="text-sm" />
          <CommandList className="max-h-none flex-1 overflow-y-auto px-2 pb-4 pt-1">
            <CommandEmpty className="px-3 py-10 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </CommandEmpty>

            {groups.map((group) => (
              <CommandGroup
                key={group.slug}
                heading={group.label}
                className={cn(
                  "overflow-visible px-1",
                  "[&_[cmdk-group-heading]]:sticky [&_[cmdk-group-heading]]:top-0 [&_[cmdk-group-heading]]:z-10",
                  "[&_[cmdk-group-heading]]:bg-background [&_[cmdk-group-heading]]:",
                  // Normal-case provider names, not an uppercase tracked eyebrow.
                  "[&_[cmdk-group-heading]]:text-[13px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:normal-case [&_[cmdk-group-heading]]:tracking-normal [&_[cmdk-group-heading]]:text-foreground/70",
                )}
              >
                {group.models.map((model) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    isSelected={value === model.id}
                    onSelect={() => handleSelect(model.id)}
                  />
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

function ModelRow({
  model,
  isSelected,
  onSelect,
}: {
  model: ModelEntry;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const hasPrice = model.promptPrice > 0 || model.completionPrice > 0;

  return (
    <CommandItem
      value={model.id}
      keywords={[model.name, model.providerLabel, model.providerSlug]}
      onSelect={onSelect}
      className={cn(
        "my-0.5 flex items-center gap-3 rounded-[--radius] px-3 py-2.5",
        // Keyboard highlight stays a quiet neutral so it's never mistaken for the
        // chosen value (which gets the tinted well + ring below). No left-stripe.
        "data-[selected=true]:bg-muted data-[selected=true]:text-foreground",
        isSelected &&
          "bg-muted ring-1 ring-inset ring-primary/25 data-[selected=true]:bg-primary/15",
      )}
    >
      {/* Brand logo on a neutral tile, keeping the provider's own color (DESIGN §5). */}
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[--radius] border border-border bg-muted">
        <ModelBrandIcon modelId={model.id} size={18} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {model.name}
          </p>
          {model.isNew ? <NewBadge /> : null}
        </div>
        {model.contextLabel ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {model.contextLabel} de contexto
          </p>
        ) : null}
      </div>

      {hasPrice ? (
        <div className="flex-shrink-0 text-right tabular-nums">
          <p className="text-xs font-medium text-foreground">
            {formatPrice(model.promptPrice)}
            <span className="ml-1 font-normal text-muted-foreground">/M in</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatPrice(model.completionPrice)} /M out
          </p>
        </div>
      ) : (
        <span className="flex-shrink-0 text-xs text-muted-foreground">
          Grátis
        </span>
      )}

      <Check
        weight="bold"
        className={cn(
          "h-4 w-4 flex-shrink-0 text-lamp-ink transition-opacity",
          isSelected ? "opacity-100" : "opacity-0",
        )}
      />
    </CommandItem>
  );
}

function NewBadge(): ReactNode {
  return (
    <span className="flex-shrink-0 rounded-[--radius] bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-lamp-ink">
      Novo
    </span>
  );
}

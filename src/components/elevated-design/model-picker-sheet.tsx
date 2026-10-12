"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
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
import { EmptyValue } from "./empty-value";
import { CapabilityFilterChips, CapabilityIcons } from "./model-capabilities";
import {
  ModelBrandIcon,
  getModelProviderLabel,
  getModelProviderSlug,
} from "./model-brand-icon";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { hasCapabilities, missingCapabilities, modelCapabilitiesOf, offeredCapabilities, pricingIndex, type ModelCapability } from "@/lib/ai-models/capabilities";
import { readFilterMemory, writeFilterMemory } from "@/lib/ai-models/model-choice-store";
import { GENERAL_SURFACE, type ModelSurface } from "@/lib/ai-models/surfaces";
import { cn } from "@/lib/utils";

const NEW_MODEL_WINDOW_DAYS = 30;

function formatPrice(price: number): string {
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
  capabilities: ModelCapability[];
  missing: ModelCapability[];
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
  surface?: ModelSurface;
  title?: string;
  description?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

function useCapabilityFilters(surface: ModelSurface, offered: readonly ModelCapability[]) {
  const [chosen, setChosen] = useState<ModelCapability[]>(() => readFilterMemory(surface.key));
  const active = useMemo(() => chosen.filter((capability) => offered.includes(capability)), [chosen, offered]);
  const remember = (next: ModelCapability[]) => {
    setChosen(next);
    writeFilterMemory(surface.key, next);
  };
  const toggle = (capability: ModelCapability) =>
    remember(active.includes(capability) ? active.filter((c) => c !== capability) : [...active, capability]);
  return { active, toggle, clear: () => remember([]) };
}

export function ModelPickerSheet({
  open,
  onOpenChange,
  value,
  onValueChange,
  models,
  modelPricing,
  surface = GENERAL_SURFACE,
  title,
  description,
  searchPlaceholder,
  emptyMessage,
}: ModelPickerSheetProps) {
  const t = useTranslations("modelPicker");
  const [nowSeconds] = useState(() => Date.now() / 1000);
  const offered = useMemo(() => offeredCapabilities(modelPricing, surface.capabilities), [modelPricing, surface.capabilities]);
  const filters = useCapabilityFilters(surface, offered);

  const groups = useMemo<ModelGroup[]>(() => {
    const pricingMap = pricingIndex(modelPricing);
    const newThreshold = nowSeconds - NEW_MODEL_WINDOW_DAYS * 24 * 60 * 60;

    const order: string[] = [];
    const byProvider = new Map<string, ModelGroup>();

    for (const id of models) {
      const pricing = pricingMap.get(id);
      if (!hasCapabilities(pricing, filters.active)) continue;
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
        capabilities: modelCapabilitiesOf(pricing).filter((capability) => surface.capabilities.includes(capability)),
        missing: missingCapabilities(pricing, surface.requires),
      });
    }

    return order.map((slug) => byProvider.get(slug)!);
  }, [models, modelPricing, nowSeconds, filters.active, surface]);

  const shownCount = useMemo(() => groups.reduce((sum, g) => sum + g.models.length, 0), [groups]);

  const resolvedDescription =
    description ??
    (models.length === 0
      ? t("noModels")
      : filters.active.length > 0
        ? t("descriptionFiltered", { shown: shownCount, count: models.length })
        : t("description", { count: models.length }));

  const handleSelect = (id: string) => {
    onValueChange?.(id);
    onOpenChange(false);
  };

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-xl lg:max-w-2xl motion-reduce:!animate-none motion-reduce:!transition-none"
      >
        <ElevatedSheetHeader className="gap-3 pr-16">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow-sm">
              <Brain weight="fill" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <ElevatedSheetTitle className="truncate text-lg">
                {title ?? t("title")}
              </ElevatedSheetTitle>
              <ElevatedSheetDescription className="truncate">
                {resolvedDescription}
              </ElevatedSheetDescription>
            </div>
          </div>
        </ElevatedSheetHeader>

        <CapabilityFilterChips offered={offered} active={filters.active} onToggle={filters.toggle} onClear={filters.clear} />

        <Command className="flex min-h-0 flex-1 flex-col rounded-none border-0 bg-transparent shadow-none">
          <CommandInput placeholder={searchPlaceholder ?? t("searchPlaceholder")} className="text-sm" />
          <CommandList className="max-h-none flex-1 overflow-y-auto px-2 pb-4 pt-1">
            <CommandEmpty className="px-3 py-10 text-center text-sm text-muted-foreground">
              {shownCount === 0 && filters.active.length > 0 ? t("emptyFiltered") : (emptyMessage ?? t("empty"))}
            </CommandEmpty>

            {groups.map((group) => (
              <CommandGroup
                key={group.slug}
                heading={group.label}
                className={cn(
                  "overflow-visible px-1",
                  "[&_[cmdk-group-heading]]:sticky [&_[cmdk-group-heading]]:top-0 [&_[cmdk-group-heading]]:z-10",
                  "[&_[cmdk-group-heading]]:bg-card [&_[cmdk-group-heading]]:py-1.5",
                  "[&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:normal-case [&_[cmdk-group-heading]]:tracking-normal [&_[cmdk-group-heading]]:text-foreground/70",
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
  const t = useTranslations("modelPicker");
  const free = model.capabilities.includes("free");
  const hasPrice = model.promptPrice > 0 || model.completionPrice > 0;
  const unavailable = model.missing.length > 0;

  return (
    <CommandItem
      value={model.id}
      keywords={[model.name, model.providerLabel, model.providerSlug]}
      onSelect={onSelect}
      disabled={unavailable}
      className={cn(
        "my-0.5 flex items-center gap-3 rounded-[--radius] px-3 py-2.5",
        "data-[selected=true]:bg-[hsl(var(--accent-hover))] data-[selected=true]:text-foreground",
        "data-[disabled=true]:opacity-60",
        isSelected &&
          "bg-[hsl(var(--accent-hover))] ring-1 ring-inset ring-primary/25 data-[selected=true]:bg-[hsl(var(--accent-hover))]",
      )}
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[--radius] border border-border bg-card dark:bg-muted">
        <ModelBrandIcon modelId={model.id} size={18} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {model.name}
          </p>
          {model.isNew ? <NewBadge label={t("newBadge")} /> : null}
          <CapabilityIcons capabilities={model.capabilities} className="flex-shrink-0" />
        </div>
        {unavailable ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {t("unavailable", { list: model.missing.map((capability) => t(`capabilities.${capability}`)).join(", ") })}
          </p>
        ) : model.contextLabel ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {t("context", { size: model.contextLabel })}
          </p>
        ) : null}
      </div>

      {hasPrice ? (
        <div className="flex-shrink-0 text-right tabular-nums">
          <p className="text-xs font-medium text-foreground">
            {formatPrice(model.promptPrice)}
            <span className="ml-1 font-normal text-muted-foreground">/M in</span>
          </p>
          <p className="text-2xs text-muted-foreground">
            {formatPrice(model.completionPrice)} /M out
          </p>
        </div>
      ) : free ? (
        <span className="flex-shrink-0 text-xs text-muted-foreground">{t("free")}</span>
      ) : (
        <EmptyValue className="flex-shrink-0 text-xs" />
      )}

      <Check
        weight="bold"
        className={cn(
          "h-4 w-4 flex-shrink-0 text-primary-ink transition-opacity",
          isSelected ? "opacity-100" : "opacity-0",
        )}
      />
    </CommandItem>
  );
}

function NewBadge({ label }: { label: string }): ReactNode {
  return (
    <span className="flex-shrink-0 rounded-[--radius] bg-muted px-1.5 py-0.5 text-2xs font-semibold leading-none text-primary-ink">
      {label}
    </span>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  MagnifyingGlass,
  Tag,
  WhatsappLogo,
  X,
} from "@/components/icons";
import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  AdvancedFilterPanel,
  type FilterFieldConfig,
  type FilterGroupConfig,
} from "@/components/filters/advanced-filter-panel";
import {
  FilterMultiSelect,
  type FilterMultiSelectOption,
} from "@/components/filters/filter-multi-select";
import { readSet, toggleInSet, withSet } from "@/lib/filters/controls";
import {
  LEAD_FILTER_FIELD,
  LEAD_FILTER_FIELDS,
  LEAD_FILTER_GROUP_ORDER,
  activeLeadPredicates,
  emptyLeadFilter,
  isEmptyLeadFilter,
  removeLeadPredicate,
  type LeadFilter,
  type LeadFilterPredicate,
} from "@/lib/leads/filters";
import type { LeadFacets } from "@/lib/leads/types";
import { cn } from "@/lib/utils";

/** Option sets that only exist at runtime: campaigns, stages, labels. */
export interface LeadFilterOptionSets {
  campaigns: FilterMultiSelectOption[];
  stages: FilterMultiSelectOption[];
  labels: FilterMultiSelectOption[];
  loading?: boolean;
}

export interface LeadsToolbarProps {
  filter: LeadFilter;
  onFilterChange: (filter: LeadFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  facets: LeadFacets | null;
  options: LeadFilterOptionSets;
  /** Slot for the saved-views control, which owns its own data. */
  savedViews?: React.ReactNode;
}

const SEARCH_DEBOUNCE_MS = 350;

/**
 * The leads filter bar.
 *
 * Three tiers, deliberately: a search box for the 80% case, the three checklist
 * filters an operator reaches for daily (channel, memory category, delivery
 * status) inline with their counts, and everything else one click away in the
 * panel. Putting nineteen controls on the page would be "complete" and unusable.
 */
export default function LeadsToolbar({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  facets,
  options,
  savedViews,
}: LeadsToolbarProps) {
  const t = useTranslations("leadsPage");

  // The input is local so typing stays instant; the URL (and therefore the
  // request) only learns about it once the operator pauses.
  const [draft, setDraft] = useState(search);
  const committed = useRef(search);

  useEffect(() => {
    if (search !== committed.current) {
      committed.current = search;
      setDraft(search);
    }
  }, [search]);

  useEffect(() => {
    if (draft === committed.current) return;
    const timer = setTimeout(() => {
      committed.current = draft;
      onSearchChange(draft);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, onSearchChange]);

  /** Facet counts for one bucket, keyed by option value. */
  const facetCounts = (
    key: "memoryCategories" | "channels" | "campaignStatuses" | undefined,
  ): Record<string, number> | undefined => {
    if (!key || !facets) return undefined;
    return facets[key];
  };

  const optionLabel = (fieldLabelKey: string, value: string) =>
    t(`filters.options.${fieldLabelKey}.${value}`);

  /**
   * The catalogue, translated and hydrated with runtime option sets. One list
   * feeds the panel, the quick filters and the chips, so a field can never be
   * filterable in one of them and invisible in the others.
   */
  const fields = useMemo<FilterFieldConfig[]>(() => {
    const runtime: Record<string, FilterMultiSelectOption[]> = {
      [LEAD_FILTER_FIELD.campaign]: options.campaigns,
      [LEAD_FILTER_FIELD.stage]: options.stages,
      [LEAD_FILTER_FIELD.label]: options.labels,
    };

    return LEAD_FILTER_FIELDS.map((spec) => {
      const counts = facetCounts(spec.facetKey);
      const staticOptions = spec.options?.map((option) => ({
        value: option.value,
        label: option.labelKey
          ? optionLabel(spec.labelKey, option.value)
          : (option.label ?? option.value),
        color: option.color,
        count: counts?.[option.value] ?? (counts ? 0 : undefined),
      }));

      const config: FilterFieldConfig = {
        field: spec.field,
        control: spec.control,
        group: spec.group,
        label: t(`filters.fields.${spec.labelKey}`),
        options: staticOptions ?? runtime[spec.field],
        loading: spec.control === "idset" ? options.loading : undefined,
      };

      // The two booleans read better as their own words than as yes/no.
      if (spec.field === LEAD_FILTER_FIELD.blocked) {
        config.trueLabel = t("filters.options.blocked.true");
        config.falseLabel = t("filters.options.blocked.false");
      }
      if (spec.field === LEAD_FILTER_FIELD.windowOpen) {
        config.trueLabel = t("filters.options.windowOpen.true");
        config.falseLabel = t("filters.options.windowOpen.false");
      }

      return config;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, facets, options]);

  const groups = useMemo<FilterGroupConfig[]>(
    () =>
      LEAD_FILTER_GROUP_ORDER.map((id) => ({
        id,
        label: t(`filters.groups.${id}`),
      })),
    [t],
  );

  const quickFields = [
    { field: LEAD_FILTER_FIELD.channel, icon: <WhatsappLogo weight="fill" className="h-3.5 w-3.5" /> },
    { field: LEAD_FILTER_FIELD.memoryCategory, icon: <Brain weight="fill" className="h-3.5 w-3.5" /> },
    { field: LEAD_FILTER_FIELD.campaignStatus, icon: <Tag weight="fill" className="h-3.5 w-3.5" /> },
  ];

  const hasAnything = !isEmptyLeadFilter(filter) || search.trim() !== "";

  const clearEverything = () => {
    setDraft("");
    committed.current = "";
    onSearchChange("");
    onFilterChange(emptyLeadFilter);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <ElevatedInput
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("search.placeholder")}
            icon={<MagnifyingGlass weight="bold" className="h-4 w-4" />}
            controlSize="sm"
            className="w-full"
          />
        </div>

        {quickFields.map(({ field, icon }) => {
          const config = fields.find((f) => f.field === field);
          if (!config) return null;
          const selected = readSet(filter, field);

          return (
            <FilterMultiSelect
              key={field}
              triggerLabel={config.label}
              icon={icon}
              options={config.options ?? []}
              selected={selected}
              onToggle={(value) => onFilterChange(toggleInSet(filter, field, value))}
              onClear={() => onFilterChange(withSet(filter, field, []))}
              searchPlaceholder={t("filters.search")}
              emptyMessage={t("filters.empty")}
              clearLabel={t("filters.clearAll")}
              className="h-9"
            />
          );
        })}

        <AdvancedFilterPanel
          value={filter}
          onChange={onFilterChange}
          fields={fields}
          groups={groups}
          labels={{
            trigger: t("filters.advanced"),
            title: t("filters.title"),
            clearAll: t("filters.clearAll"),
            any: t("filters.any"),
            yes: t("filters.yes"),
            no: t("filters.no"),
            from: t("filters.from"),
            to: t("filters.to"),
            min: t("filters.min"),
            max: t("filters.max"),
            search: t("filters.search"),
            empty: t("filters.empty"),
            loading: t("filters.loading"),
            done: t("filters.done"),
          }}
        />

        {savedViews}
      </div>

      <LeadFilterChips
        filter={filter}
        onFilterChange={onFilterChange}
        fields={fields}
        onClearAll={hasAnything ? clearEverything : undefined}
      />
    </div>
  );
}

/**
 * The active-filter row.
 *
 * Every constraint is visible and individually removable. A filter you can set
 * but cannot see is the reason people reload the page to "reset" a list, and a
 * count badge alone does not tell you WHICH four things are hiding your rows.
 */
function LeadFilterChips({
  filter,
  onFilterChange,
  fields,
  onClearAll,
}: {
  filter: LeadFilter;
  onFilterChange: (filter: LeadFilter) => void;
  fields: FilterFieldConfig[];
  onClearAll?: () => void;
}) {
  const t = useTranslations("leadsPage");
  const predicates = activeLeadPredicates(filter);

  if (predicates.length === 0 && !onClearAll) return null;

  const describe = (predicate: LeadFilterPredicate): string => {
    const config = fields.find((f) => f.field === predicate.field);
    const label = config?.label ?? predicate.field;

    const valueLabels = predicate.values.map((value) => {
      const option = config?.options?.find((o) => o.value === value);
      return option?.label ?? value;
    });

    switch (predicate.operator) {
      case "contains":
        return `${label}: ${t("filters.chips.contains")} "${valueLabels[0] ?? ""}"`;
      case "in":
        return `${label}: ${valueLabels.join(", ")}`;
      case "not_in":
        return `${label}: ${t("filters.chips.notIn")} ${valueLabels.join(", ")}`;
      case "gte":
        return `${label} ${t("filters.chips.gte")} ${valueLabels[0] ?? ""}`;
      case "lte":
        return `${label} ${t("filters.chips.lte")} ${valueLabels[0] ?? ""}`;
      case "is_set":
        return `${t("filters.chips.isSet")} ${label.toLowerCase()}`;
      case "is_empty":
        return `${t("filters.chips.isEmpty")} ${label.toLowerCase()}`;
      case "is_true":
        return `${label}: ${config?.trueLabel ?? t("filters.chips.isTrue")}`;
      case "is_false":
        return `${label}: ${config?.falseLabel ?? t("filters.chips.isFalse")}`;
      default:
        return `${label}: ${valueLabels.join(", ")}`;
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {predicates.map((predicate) => (
        <button
          key={`${predicate.field}-${predicate.operator}`}
          type="button"
          onClick={() =>
            onFilterChange(
              removeLeadPredicate(filter, predicate.field, predicate.operator),
            )
          }
          title={t("filters.chips.remove")}
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1",
            "text-2xs font-medium text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5",
          )}
        >
          <span>{describe(predicate)}</span>
          <X
            weight="bold"
            className="h-2.5 w-2.5 text-muted-foreground transition-colors group-hover:text-destructive-ink"
          />
        </button>
      ))}

      {onClearAll ? (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-1 text-2xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          {t("records.clearFilters")}
        </button>
      ) : null}
    </div>
  );
}

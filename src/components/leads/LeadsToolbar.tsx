"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { RetryNotice } from "@/components/elevated-design/retry-notice";
import {
  AdvancedFilterPanel,
  type FilterFieldConfig,
  type FilterGroupConfig,
} from "@/components/filters/advanced-filter-panel";
import { FilterMultiSelect } from "@/components/filters/filter-multi-select";
import { Area, Buildings, MapPin, Tag, UserCheck, X } from "@/components/icons";
import { useInView } from "@/hooks/use-in-view";
import { useLeadSection } from "@/hooks/use-lead-section";
import { isBusySectionError } from "@/lib/analytics/section-query";
import { readSet, toggleInSet, withSet } from "@/lib/filters/controls";
import {
  cityOptions,
  countedOptions,
  districtOptions,
  keepSelected,
  ownerOptions,
  type LeadFilterChoice,
} from "@/lib/leads/filter-options";
import {
  LEAD_FILTER_FIELD,
  LEAD_FILTER_GROUP_ORDER,
  activeLeadPredicates,
  customFieldFilterField,
  emptyLeadFilter,
  isEmptyLeadFilter,
  leadFilterFieldSpecs,
  leadPredicateAddress,
  leadQuickFilterFields,
  removeLeadPredicate,
  type LeadFilter,
  type LeadFilterOption,
  type LeadFilterPredicate,
  type LeadRuntimeOptions,
} from "@/lib/leads/filters";
import type { LeadFacetsSection } from "@/lib/leads/sections";
import { toneCssColor } from "@/lib/tones/tones";
import { cn } from "@/lib/utils";

import { PLAIN_LEAD_ENTRY_CONTROLS, useLeadEntryControls, type LeadEntryControls } from "./LeadEntryFilters";
import { LeadSearchBox } from "./LeadSearchBox";
import { useLeadFilterOptions, type LeadFilterOptionSets } from "./use-lead-filter-options";

export interface LeadsToolbarProps {
  filter: LeadFilter;
  onFilterChange: (filter: LeadFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  countFacets?: boolean;
  savedViews?: ReactNode;
  areas?: readonly LeadToolbarArea[];
  resultCount?: number | null;
  onPickPlace?: (filter: LeadFilter) => void;
}

export interface LeadToolbarArea {
  id: string;
  name: string;
}

const QUICK_ICONS: Record<string, ReactNode> = {
  [LEAD_FILTER_FIELD.district]: <MapPin weight="fill" className="h-3.5 w-3.5" />,
  [LEAD_FILTER_FIELD.city]: <Buildings weight="fill" className="h-3.5 w-3.5" />,
  [LEAD_FILTER_FIELD.owner]: <UserCheck weight="fill" className="h-3.5 w-3.5" />,
};

const CLASSIFICATION_ICON = <Tag weight="fill" className="h-3.5 w-3.5" />;

type Translator = (key: string, values?: Record<string, string>) => string;

function choiceOf(option: LeadFilterOption, label: (option: LeadFilterOption) => string): LeadFilterChoice {
  const color = option.tone ? toneCssColor(option.tone) : option.color;
  return color ? { value: option.value, label: label(option), color } : { value: option.value, label: label(option) };
}

export function LeadsToolbar({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  countFacets = false,
  savedViews,
  areas,
  resultCount = null,
  onPickPlace,
}: LeadsToolbarProps) {
  const t = useTranslations("leadsPage");
  const tr = useTranslations();
  const tMetrics = useTranslations("metricsOps.common");

  const cityKeys = readSet(filter, LEAD_FILTER_FIELD.city);
  const options = useLeadFilterOptions({ cityKeys });

  const [ref, inView] = useInView<HTMLDivElement>();
  const facetsQuery = useLeadSection("facets", { filter, q: search }, { enabled: countFacets && inView });
  const facets = countFacets ? facetsQuery.data ?? null : null;

  const entries = useLeadEntryControls(filter);

  const fields = useMemo(
    () => leadFilterFieldConfigs({ filter, options, facets, entries, t, tr }),
    [filter, options, facets, entries, t, tr],
  );

  const chipFields = useMemo<FilterFieldConfig[]>(
    () => [
      ...fields,
      areaFilterFieldConfig(areas ?? [], t("filters.fields.area")),
      areaFilterFieldConfig(areas ?? [], t("filters.fields.areaApproximate"), LEAD_FILTER_FIELD.areaApproximate),
    ],
    [fields, areas, t],
  );

  const groups = useMemo<FilterGroupConfig[]>(
    () => LEAD_FILTER_GROUP_ORDER.map((id) => ({ id, label: t(`filters.groups.${id}`) })),
    [t],
  );

  const classificationField = options.classification ? customFieldFilterField(options.classification) : undefined;
  const quickFields = leadQuickFilterFields(classificationField);

  const hasAnything = !isEmptyLeadFilter(filter) || search.trim() !== "";
  const optionsNotice =
    options.failed.length > 0
      ? t("filters.optionsFailed")
      : options.fieldsFailed
        ? t("filters.customFailed")
        : null;
  const hasNotice = optionsNotice !== null || (countFacets && facetsQuery.isError);

  const clearEverything = () => {
    onSearchChange("");
    onFilterChange(emptyLeadFilter);
  };

  const pickPlace =
    onPickPlace ??
    ((next: LeadFilter) => {
      onSearchChange("");
      onFilterChange(next);
    });

  return (
    <div ref={ref} className="flex w-full flex-col gap-3">
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <LeadSearchBox
            search={search}
            onSearchChange={onSearchChange}
            filter={filter}
            onPickPlace={pickPlace}
            resultCount={resultCount}
          />
        </div>

        {quickFields.map((field) => {
          const config = fields.find((f) => f.field === field);
          if (!config) return null;
          return (
            <FilterMultiSelect
              key={field}
              triggerLabel={config.label}
              icon={QUICK_ICONS[field] ?? CLASSIFICATION_ICON}
              options={config.options ?? []}
              selected={readSet(filter, field)}
              onToggle={(value) => onFilterChange(toggleInSet(filter, field, value))}
              onClear={() => onFilterChange(withSet(filter, field, []))}
              searchPlaceholder={t("filters.search")}
              emptyMessage={config.loading ? t("filters.loading") : config.emptyMessage ?? t("filters.empty")}
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
        fields={chipFields}
        onClearAll={hasAnything ? clearEverything : undefined}
        notice={
          hasNotice ? (
            <>
              {countFacets && facetsQuery.isError ? (
                <RetryNotice
                  message={isBusySectionError(facetsQuery.error) ? tMetrics("sectionBusy") : t("filters.facetsFailed")}
                  retryLabel={tMetrics("retry")}
                  retrying={facetsQuery.isFetching}
                  onRetry={() => void facetsQuery.refetch()}
                />
              ) : null}
              {optionsNotice ? (
                <RetryNotice message={optionsNotice} retryLabel={tMetrics("retry")} onRetry={options.retry} />
              ) : null}
            </>
          ) : undefined
        }
      />
    </div>
  );
}

export function leadFilterFieldConfigs({
  filter: current,
  options: sets,
  facets: counts,
  entries = PLAIN_LEAD_ENTRY_CONTROLS,
  t,
  tr,
}: {
  filter: LeadFilter;
  options: LeadFilterOptionSets;
  facets: LeadFacetsSection | null;
  entries?: LeadEntryControls;
  t: Translator;
  tr: Translator;
}): FilterFieldConfig[] {
  const label = (option: LeadFilterOption) => (option.labelKey ? tr(option.labelKey) : (option.label ?? option.value));
  const failedMessage = (kind: LeadRuntimeOptions) => (sets.failed.includes(kind) ? t("filters.failed") : undefined);

  const runtime = (kind: LeadRuntimeOptions, field: string): LeadFilterChoice[] => {
    const selected = readSet(current, field);
    switch (kind) {
      case "campaigns":
      case "stages":
      case "labels":
        return keepSelected(sets[kind], selected, (value) => value);
      case "owners":
        return ownerOptions({
          owners: counts?.owners ?? null,
          members: sets.members,
          ownersTruncated: counts?.ownersTruncated !== false,
          selected,
          unnamed: t("filters.options.ownerUnnamed"),
        });
      case "cities":
        return cityOptions(sets.cities, selected, (city) =>
          t("filters.options.cityOf", { city: city.city, state: city.state }),
        );
      case "districts":
        return districtOptions(sets.districts, selected, (district) =>
          t("filters.options.districtOf", { district: district.district, city: district.city }),
        );
    }
  };

  const catalogue = leadFilterFieldSpecs({ readsAddresses: sets.readsAddresses }).map((spec) => {
    const config: FilterFieldConfig = {
      field: spec.field,
      control: spec.control,
      group: spec.group,
      label: t(`filters.fields.${spec.labelKey}`),
    };
    if (spec.options) {
      const facetCounts = spec.facetKey && counts ? counts[spec.facetKey] : undefined;
      config.options = countedOptions(spec.options.map((option) => choiceOf(option, label)), facetCounts);
    }
    if (spec.runtimeOptions) {
      config.options = runtime(spec.runtimeOptions, spec.field);
      config.loading = sets.pending.includes(spec.runtimeOptions);
      config.emptyMessage = failedMessage(spec.runtimeOptions);
    }
    if (spec.sides) {
      config.trueLabel = tr(spec.sides.true);
      config.falseLabel = tr(spec.sides.false);
    }
    if (spec.presence) {
      config.presence = { trueLabel: tr(spec.presence.true), falseLabel: tr(spec.presence.false) };
    }
    if (spec.entry) {
      config.options = entries.options(spec.entry, readSet(current, spec.field));
      const renderControl = entries.render?.(spec.entry, spec.field, config.label);
      if (renderControl) config.renderControl = renderControl;
    }
    return config;
  });

  const classificationCounts =
    counts?.classification && sets.classification && counts.classification.key === sets.classification.key
      ? counts.classification.values
      : undefined;

  const custom = sets.customFields.map((spec) => {
    const config: FilterFieldConfig = {
      field: spec.field,
      control: spec.control,
      group: spec.group,
      label: spec.label,
    };
    if (spec.options) {
      const choices = spec.options.map((option) => choiceOf(option, label));
      const isClassification =
        sets.classification !== undefined && spec.field === customFieldFilterField(sets.classification);
      config.options = keepSelected(
        countedOptions(choices, isClassification ? classificationCounts : undefined),
        readSet(current, spec.field),
        (value) => value,
      );
    }
    return config;
  });

  return [...catalogue, ...custom];
}

const AREA_FIELDS: readonly string[] = [LEAD_FILTER_FIELD.area, LEAD_FILTER_FIELD.areaApproximate];

export function areaFilterFieldConfig(
  areas: readonly LeadToolbarArea[],
  label: string,
  field: typeof LEAD_FILTER_FIELD.area | typeof LEAD_FILTER_FIELD.areaApproximate = LEAD_FILTER_FIELD.area,
): FilterFieldConfig {
  return {
    field,
    control: "enum",
    group: "address",
    label,
    options: areas.map((area) => ({ value: area.id, label: area.name })),
  };
}

export function describeLeadPredicate(predicate: LeadFilterPredicate, fields: readonly FilterFieldConfig[], t: Translator): string {
  const config = fields.find((f) => f.field === leadPredicateAddress(predicate));
  const label = config?.label ?? predicate.key ?? predicate.field;

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
      return config?.presence?.trueLabel ?? `${t("filters.chips.isSet")} ${label.toLowerCase()}`;
    case "is_empty":
      return config?.presence?.falseLabel ?? `${t("filters.chips.isEmpty")} ${label.toLowerCase()}`;
    case "is_true":
      return `${label}: ${config?.trueLabel ?? t("filters.chips.isTrue")}`;
    case "is_false":
      return `${label}: ${config?.falseLabel ?? t("filters.chips.isFalse")}`;
    default:
      return `${label}: ${valueLabels.join(", ")}`;
  }
}

function LeadFilterChips({
  filter,
  onFilterChange,
  fields,
  onClearAll,
  notice,
}: {
  filter: LeadFilter;
  onFilterChange: (filter: LeadFilter) => void;
  fields: FilterFieldConfig[];
  onClearAll?: () => void;
  notice?: ReactNode;
}) {
  const t = useTranslations("leadsPage");
  const predicates = activeLeadPredicates(filter);

  if (predicates.length === 0 && !onClearAll && !notice) return null;

  const describe = (predicate: LeadFilterPredicate): string => describeLeadPredicate(predicate, fields, t);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {predicates.map((predicate) => (
        <button
          key={`${leadPredicateAddress(predicate)}-${predicate.operator}`}
          type="button"
          onClick={() => onFilterChange(removeLeadPredicate(filter, leadPredicateAddress(predicate), predicate.operator))}
          title={t("filters.chips.remove")}
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1",
            "text-2xs font-medium text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5",
          )}
        >
          {AREA_FIELDS.includes(leadPredicateAddress(predicate)) ? (
            <Area aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
          ) : null}
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

      {notice}
    </div>
  );
}

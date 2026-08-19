"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { CaretDown, FunnelSimple, X } from "@/components/icons";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  FilterMultiSelect,
  type FilterMultiSelectOption,
} from "@/components/filters/filter-multi-select";
import {
  countFilterPredicates,
  emptyCrmFilter,
  type CrmFilter,
} from "@/lib/crm/board";
import {
  readBoolean,
  readBound,
  readPresence,
  readSet,
  readText,
  toggleInSet,
  withBoolean,
  withBound,
  withPresence,
  withSet,
  withText,
} from "@/lib/filters/controls";
import { cn } from "@/lib/utils";

/**
 * How a field is rendered. The same six shapes cover every filterable attribute
 * we have — which is the point: a list declares WHAT it can filter on and this
 * panel decides how to ask, so a new field costs one catalogue entry rather
 * than a new control, a new predicate writer and a new chip renderer.
 */
export type FilterControlKind =
  | "text"
  | "enum"
  | "idset"
  | "number"
  | "date"
  | "boolean"
  | "presence";

export interface FilterFieldConfig {
  field: string;
  control: FilterControlKind;
  label: string;
  /** Section id; must match one of `groups`. */
  group: string;
  options?: FilterMultiSelectOption[];
  placeholder?: string;
  /** Runtime-loaded option sets (campaigns, stages, labels) render a hint. */
  loading?: boolean;
  /** Overrides the generic yes/no wording, e.g. "Bloqueado" / "Ativo". */
  trueLabel?: string;
  falseLabel?: string;
}

export interface FilterGroupConfig {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface AdvancedFilterPanelLabels {
  trigger: string;
  title: string;
  clearAll: string;
  any: string;
  yes: string;
  no: string;
  from: string;
  to: string;
  min: string;
  max: string;
  search: string;
  empty: string;
  loading: string;
  done: string;
}

export interface AdvancedFilterPanelProps {
  value: CrmFilter;
  onChange: (filter: CrmFilter) => void;
  fields: FilterFieldConfig[];
  groups: FilterGroupConfig[];
  labels: AdvancedFilterPanelLabels;
  className?: string;
}

/** Three-way switch: yes / no / no opinion. */
function TriStateToggle({
  value,
  onChange,
  labels,
  trueLabel,
  falseLabel,
}: {
  value: boolean | null;
  onChange: (next: boolean | null) => void;
  labels: AdvancedFilterPanelLabels;
  trueLabel?: string;
  falseLabel?: string;
}) {
  const options: { value: boolean | null; label: string }[] = [
    { value: null, label: labels.any },
    { value: true, label: trueLabel ?? labels.yes },
    { value: false, label: falseLabel ?? labels.no },
  ];

  return (
    <div className="inline-flex rounded-[--radius] border border-border bg-card p-0.5">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[calc(var(--radius)-2px)] px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FieldControl({
  config,
  value,
  onChange,
  labels,
}: {
  config: FilterFieldConfig;
  value: CrmFilter;
  onChange: (filter: CrmFilter) => void;
  labels: AdvancedFilterPanelLabels;
}) {
  const { field, control } = config;

  switch (control) {
    case "text":
      return (
        <ElevatedInput
          value={readText(value, field)}
          placeholder={config.placeholder ?? config.label}
          controlSize="sm"
          onChange={(e) => onChange(withText(value, field, e.target.value))}
        />
      );

    case "enum":
    case "idset": {
      const selected = readSet(value, field);
      return (
        <FilterMultiSelect
          triggerLabel={config.label}
          icon={<FunnelSimple weight="bold" className="h-3.5 w-3.5" />}
          options={config.options ?? []}
          selected={selected}
          onToggle={(option) => onChange(toggleInSet(value, field, option))}
          onClear={() => onChange(withSet(value, field, []))}
          searchPlaceholder={labels.search}
          emptyMessage={config.loading ? labels.loading : labels.empty}
          clearLabel={labels.clearAll}
          className="h-9 w-full justify-between"
        />
      );
    }

    case "number":
      return (
        <div className="flex items-center gap-2">
          <ElevatedInput
            type="number"
            inputMode="numeric"
            min={0}
            value={readBound(value, field, "gte")}
            placeholder={labels.min}
            controlSize="sm"
            onChange={(e) =>
              onChange(withBound(value, field, "gte", e.target.value))
            }
          />
          <span className="text-xs text-muted-foreground">–</span>
          <ElevatedInput
            type="number"
            inputMode="numeric"
            min={0}
            value={readBound(value, field, "lte")}
            placeholder={labels.max}
            controlSize="sm"
            onChange={(e) =>
              onChange(withBound(value, field, "lte", e.target.value))
            }
          />
        </div>
      );

    case "date":
      return (
        <div className="flex items-center gap-2">
          <ElevatedDatePicker
            id={`${field}-from`}
            value={readBound(value, field, "gte")}
            placeholder={labels.from}
            onChange={(next) =>
              onChange(withBound(value, field, "gte", next ?? ""))
            }
          />
          <ElevatedDatePicker
            id={`${field}-to`}
            value={readBound(value, field, "lte")}
            placeholder={labels.to}
            onChange={(next) =>
              onChange(withBound(value, field, "lte", next ?? ""))
            }
          />
        </div>
      );

    case "boolean":
      return (
        <TriStateToggle
          value={readBoolean(value, field)}
          onChange={(next) => onChange(withBoolean(value, field, next))}
          labels={labels}
          trueLabel={config.trueLabel}
          falseLabel={config.falseLabel}
        />
      );

    case "presence":
      return (
        <TriStateToggle
          value={readPresence(value, field)}
          onChange={(next) => onChange(withPresence(value, field, next))}
          labels={labels}
          trueLabel={config.trueLabel}
          falseLabel={config.falseLabel}
        />
      );

    default:
      return null;
  }
}

/**
 * A filter panel built from a field catalogue.
 *
 * Every control is fully controlled by `value`, so the panel hydrates straight
 * from a URL-restored filter with no internal mirror to keep in sync — the
 * usual source of "I cleared it but it came back".
 */
export function AdvancedFilterPanel({
  value,
  onChange,
  fields,
  groups,
  labels,
  className,
}: AdvancedFilterPanelProps) {
  const [open, setOpen] = useState(false);
  const activeCount = countFilterPredicates(value);

  const byGroup = useMemo(() => {
    return groups
      .map((group) => ({
        group,
        fields: fields.filter((f) => f.group === group.id),
      }))
      .filter((section) => section.fields.length > 0);
  }, [groups, fields]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-[--radius] border bg-card px-3 text-sm font-medium transition-colors",
            activeCount > 0
              ? "border-primary/40 text-foreground"
              : "border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted",
            className,
          )}
        >
          <FunnelSimple weight="bold" className="h-4 w-4" />
          <span>{labels.trigger}</span>
          {activeCount > 0 ? (
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-[--radius] bg-primary px-1.5 text-2xs font-semibold text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
          <CaretDown
            weight="bold"
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[min(92vw,42rem)] rounded-[--radius] border border-border bg-card p-0 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-xs font-semibold text-foreground">
            {labels.title}
          </span>
          <div className="flex items-center gap-3">
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={() => onChange(emptyCrmFilter)}
                className="inline-flex items-center gap-1 text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <X weight="bold" className="h-3 w-3" />
                {labels.clearAll}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-2xs font-semibold text-primary-ink transition-colors hover:text-[hsl(var(--primary-hover))]"
            >
              {labels.done}
            </button>
          </div>
        </div>

        <div className="max-h-[min(70vh,32rem)] overflow-y-auto px-4 py-3">
          {byGroup.map(({ group, fields: groupFields }) => (
            <Fragment key={group.id}>
              <div className="mb-2 mt-3 flex items-center gap-1.5 first:mt-0">
                {group.icon ? (
                  <span className="text-muted-foreground">{group.icon}</span>
                ) : null}
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                {groupFields.map((config) => (
                  <div key={config.field} className="flex flex-col gap-1.5">
                    <span className="text-2xs font-medium text-muted-foreground">
                      {config.label}
                    </span>
                    <FieldControl
                      config={config}
                      value={value}
                      onChange={onChange}
                      labels={labels}
                    />
                  </div>
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default AdvancedFilterPanel;

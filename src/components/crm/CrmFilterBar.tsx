"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CaretDown, Check, FunnelSimple, Tag, X } from "@/components/icons";

import type { Label } from "@/lib/conversations/types";
import type { CrmFilter, CrmFilterPredicate } from "@/lib/crm/board";
import { emptyCrmFilter, isEmptyCrmFilter } from "@/lib/crm/board";
import {
  listAssignableMembersAction,
  type AssignableMember,
} from "@/app/actions/workspace";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedButton from "@/components/elevated-design/button";
import { cn } from "@/lib/utils";

// A conversation carries exactly one status; we still model it as a set so the
// bar can filter on several at once (operator `in`). Labels default to the four
// conversation lifecycle states the product uses everywhere.
export interface CrmFilterStatusOption {
  value: string;
  label: string;
}

const DEFAULT_STATUS_OPTIONS: CrmFilterStatusOption[] = [
  { value: "new", label: "Aberta" },
  { value: "ongoing", label: "Em andamento" },
  { value: "finished", label: "Finalizada" },
];

const GROUP_CONJUNCTION = "and" as const;
const OWNER_ALL = "__all_owners__";
// Sentinel for the "no responsible" filter: maps to the `owner is_empty` predicate the
// board's "Sem responsável" swimlane already uses, so the table can isolate the pool of
// unassigned conversations (a standard queue/triage view).
const OWNER_UNASSIGNED = "__unassigned__";

// The whole bar lives in a single AND group; each control owns one (field,
// operator) predicate. These helpers keep that model in one place so building
// and reading a CrmFilter never drift.
function predicates(filter: CrmFilter): CrmFilterPredicate[] {
  return filter.groups[0]?.predicates ?? [];
}

function fromPredicates(list: CrmFilterPredicate[]): CrmFilter {
  if (list.length === 0) return emptyCrmFilter;
  return { groups: [{ conjunction: GROUP_CONJUNCTION, predicates: list }] };
}

function readValues(
  filter: CrmFilter,
  field: string,
  operator: string,
): string[] {
  return (
    predicates(filter).find(
      (p) => p.field === field && p.operator === operator,
    )?.values ?? []
  );
}

// Replace (or clear, when `values` is empty) the predicate for a (field,
// operator) pair and return a fresh filter.
function withPredicate(
  filter: CrmFilter,
  field: string,
  operator: string,
  values: string[],
): CrmFilter {
  const next = predicates(filter).filter(
    (p) => !(p.field === field && p.operator === operator),
  );
  if (values.length > 0) next.push({ field, operator, values });
  return fromPredicates(next);
}

interface FilterMultiSelectProps {
  triggerLabel: string;
  icon: React.ReactNode;
  options: { value: string; label: string; color?: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  searchPlaceholder: string;
  emptyMessage: string;
}

// A quiet neutral dropdown checklist (Popover + cmdk). Reuses the same
// primitives the house selects are built on; state shows as a count badge and
// per-row checks, never a colored pill.
function FilterMultiSelect({
  triggerLabel,
  icon,
  options,
  selected,
  onToggle,
  onClear,
  searchPlaceholder,
  emptyMessage,
}: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const count = selected.length;
  const active = count > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-[--radius] border bg-card px-3.5 text-sm font-medium transition-colors",
            active
              ? "border-primary/40 text-foreground"
              : "border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted",
          )}
        >
          <span className="text-muted-foreground">{icon}</span>
          <span>{triggerLabel}</span>
          {active ? (
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-[--radius] bg-primary px-1.5 text-[11px] font-semibold text-white">
              {count}
            </span>
          ) : null}
          <CaretDown
            weight="bold"
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 rounded-[--radius] border border-border bg-card p-0 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {triggerLabel}
          </span>
          {active ? (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-medium text-lamp-ink transition-colors hover:text-[hsl(var(--primary-hover))]"
            >
              Limpar
            </button>
          ) : null}
        </div>
        <Command
          shouldFilter
          className="rounded-none bg-transparent text-foreground"
        >
          <CommandInput placeholder={searchPlaceholder} className="text-sm" />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.value} ${option.label}`.toLowerCase()}
                    onSelect={() => onToggle(option.value)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs",
                      "data-[selected=true]:bg-muted",
                      isSelected ? "text-foreground" : "text-foreground",
                    )}
                  >
                    {option.color ? (
                      <span
                        className="h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-black/5"
                        style={{ backgroundColor: option.color }}
                      />
                    ) : null}
                    <span className="flex-1 truncate font-medium">
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-md border transition-all duration-150",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-foreground/20 bg-card",
                      )}
                    >
                      {isSelected ? (
                        <Check weight="bold" className="h-2.5 w-2.5 text-white" />
                      ) : null}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export interface CrmFilterBarProps {
  value: CrmFilter;
  onChange: (filter: CrmFilter) => void;
  labels: Label[];
  workspaceId?: string;
  // Value min/max only makes sense for the opportunity board; off by default so
  // the conversation board omits it. The bar stays otherwise identical.
  showValue?: boolean;
  showStatus?: boolean;
  statusOptions?: CrmFilterStatusOption[];
  // Which date field the range maps to (created_at for conversations,
  // close_date for opportunities).
  dateField?: string;
  className?: string;
}

export default function CrmFilterBar({
  value,
  onChange,
  labels,
  workspaceId,
  showValue = false,
  showStatus = true,
  statusOptions = DEFAULT_STATUS_OPTIONS,
  dateField = "created_at",
  className,
}: CrmFilterBarProps) {
  const [members, setMembers] = useState<AssignableMember[]>([]);

  // Load the assignable members once for the owner select. The list is capped
  // and filtered client-side; the picker is a single-select "one owner" filter.
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      const res = await listAssignableMembersAction(workspaceId, {
        pageSize: 200,
      });
      if (!cancelled && !res.error) setMembers(res.members);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Every control derives straight from `value`, so the bar is fully controlled
  // and hydrates from a URL-restored filter with no internal mirror to sync.
  const statuses = readValues(value, "status", "in");
  const labelIds = readValues(value, "label", "in");
  const ownerId = readValues(value, "owner", "eq")[0] ?? "";
  const ownerUnassigned = predicates(value).some(
    (p) => p.field === "owner" && p.operator === "is_empty",
  );
  const ownerValue = ownerUnassigned ? OWNER_UNASSIGNED : ownerId || OWNER_ALL;
  const valueMin = readValues(value, "value", "gte")[0] ?? "";
  const valueMax = readValues(value, "value", "lte")[0] ?? "";
  const dateStart = readValues(value, dateField, "gte")[0] ?? "";
  const dateEnd = readValues(value, dateField, "lte")[0] ?? "";

  const toggleInValues = useCallback(
    (field: string, current: string[], toggled: string) => {
      const next = current.includes(toggled)
        ? current.filter((v) => v !== toggled)
        : [...current, toggled];
      onChange(withPredicate(value, field, "in", next));
    },
    [onChange, value],
  );

  const labelOptions = useMemo(
    () =>
      [...labels]
        .sort((a, b) => a.position - b.position)
        .map((l) => ({ value: l.id, label: l.name, color: l.color })),
    [labels],
  );

  const ownerOptions = useMemo(
    () => [
      { value: OWNER_ALL, label: "Todos os responsáveis" },
      { value: OWNER_UNASSIGNED, label: "Sem responsável" },
      ...members.map((m) => ({
        value: m.userId,
        label: m.username?.trim() || m.email?.trim() || m.userId,
      })),
    ],
    [members],
  );

  // Owner is a single-select across three predicate shapes: none (all), `is_empty`
  // (unassigned) and `eq <id>` (one person). Clear any existing owner predicate first
  // so the shapes never coexist.
  const setOwner = useCallback(
    (v: string) => {
      const next = predicates(value).filter((p) => p.field !== "owner");
      if (v === OWNER_UNASSIGNED) {
        next.push({ field: "owner", operator: "is_empty", values: [] });
      } else if (v && v !== OWNER_ALL) {
        next.push({ field: "owner", operator: "eq", values: [v] });
      }
      onChange(fromPredicates(next));
    },
    [onChange, value],
  );

  const setValueBound = useCallback(
    (operator: "gte" | "lte", raw: string) => {
      const trimmed = raw.trim();
      onChange(
        withPredicate(value, "value", operator, trimmed ? [trimmed] : []),
      );
    },
    [onChange, value],
  );

  const setDateBound = useCallback(
    (operator: "gte" | "lte", raw: string) => {
      onChange(withPredicate(value, dateField, operator, raw ? [raw] : []));
    },
    [onChange, value, dateField],
  );

  const hasAny = !isEmptyCrmFilter(value);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5",
        className,
      )}
    >
      {showStatus ? (
        <FilterMultiSelect
          triggerLabel="Status"
          icon={<FunnelSimple weight="bold" className="h-4 w-4" />}
          options={statusOptions}
          selected={statuses}
          onToggle={(v) => toggleInValues("status", statuses, v)}
          onClear={() => onChange(withPredicate(value, "status", "in", []))}
          searchPlaceholder="Buscar status..."
          emptyMessage="Nenhum status"
        />
      ) : null}

      <FilterMultiSelect
        triggerLabel="Etiqueta"
        icon={<Tag weight="bold" className="h-4 w-4" />}
        options={labelOptions}
        selected={labelIds}
        onToggle={(v) => toggleInValues("label", labelIds, v)}
        onClear={() => onChange(withPredicate(value, "label", "in", []))}
        searchPlaceholder="Buscar etiqueta..."
        emptyMessage="Nenhuma etiqueta"
      />

      <div className="w-56">
        <ElevatedCommandSelect
          label="Responsável"
          options={ownerOptions}
          value={ownerValue}
          onValueChange={setOwner}
          searchPlaceholder="Buscar responsável..."
          emptyMessage="Nenhum responsável"
          fullWidth
        />
      </div>

      {showValue ? (
        <div className="flex items-center gap-2">
          <div className="w-32">
            <ElevatedInput
              id="crm-filter-value-min"
              type="number"
              label="Valor mínimo"
              variant="outline"
              controlSize="sm"
              value={valueMin}
              onChange={(e) => setValueBound("gte", e.target.value)}
            />
          </div>
          <div className="w-32">
            <ElevatedInput
              id="crm-filter-value-max"
              type="number"
              label="Valor máximo"
              variant="outline"
              controlSize="sm"
              value={valueMax}
              onChange={(e) => setValueBound("lte", e.target.value)}
            />
          </div>
        </div>
      ) : null}

      <div className="w-40">
        <ElevatedDatePicker
          id="crm-filter-date-start"
          label="Data início"
          value={dateStart}
          onChange={(v) => setDateBound("gte", v)}
        />
      </div>
      <div className="w-40">
        <ElevatedDatePicker
          id="crm-filter-date-end"
          label="Data fim"
          value={dateEnd}
          onChange={(v) => setDateBound("lte", v)}
        />
      </div>

      <div className="flex-1" />

      {hasAny ? (
        <ElevatedButton
          variant="outline-subtle"
          size="sm"
          title="Limpar"
          onClick={() => onChange(emptyCrmFilter)}
          icon={<X weight="bold" className="h-3.5 w-3.5" />}
          iconVisible
        />
      ) : null}
    </div>
  );
}

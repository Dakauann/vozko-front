"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FunnelSimple, Stack, Tag, X } from "@/components/icons";

import type { Label, Stage } from "@/lib/conversations/types";
import type { CrmFilter } from "@/lib/crm/board";
import {
  emptyCrmFilter,
  filterFromPredicates as fromPredicates,
  filterPredicates as predicates,
  isEmptyCrmFilter,
  readFilterValues as readValues,
  withFilterPredicate as withPredicate,
} from "@/lib/crm/board";
import {
  listAssignableMembersAction,
  type AssignableMember,
} from "@/app/actions/workspace";

import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { FilterMultiSelect } from "@/components/filters/filter-multi-select";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedButton from "@/components/elevated-design/button";
import { cn } from "@/lib/utils";

export interface CrmFilterStatusOption {
  value: string;
  label: string;
}

const DEFAULT_STATUS_OPTIONS: CrmFilterStatusOption[] = [
  { value: "new", label: "Aberta" },
  { value: "ongoing", label: "Em andamento" },
  { value: "finished", label: "Finalizada" },
];

const OWNER_ALL = "__all_owners__";
const OWNER_UNASSIGNED = "__unassigned__";


export interface CrmFilterBarProps {
  value: CrmFilter;
  onChange: (filter: CrmFilter) => void;
  labels: Label[];
  stages?: Stage[];
  workspaceId?: string;
  showValue?: boolean;
  showStatus?: boolean;
  statusOptions?: CrmFilterStatusOption[];
  dateField?: string;
  className?: string;
}

export default function CrmFilterBar({
  value,
  onChange,
  labels,
  stages = [],
  workspaceId,
  showValue = false,
  showStatus = true,
  statusOptions = DEFAULT_STATUS_OPTIONS,
  dateField = "created_at",
  className,
}: CrmFilterBarProps) {
  const [members, setMembers] = useState<AssignableMember[]>([]);

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

  const statuses = readValues(value, "status", "in");
  const stageIds = readValues(value, "stage", "in");
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

  const stageOptions = useMemo(
    () =>
      [...stages]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ value: s.id, label: s.name, color: s.color })),
    [stages],
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

      {
}
      {stageOptions.length > 0 ? (
        <FilterMultiSelect
          triggerLabel="Etapa"
          icon={<Stack weight="bold" className="h-4 w-4" />}
          options={stageOptions}
          selected={stageIds}
          onToggle={(v) => toggleInValues("stage", stageIds, v)}
          onClear={() => onChange(withPredicate(value, "stage", "in", []))}
          searchPlaceholder="Buscar etapa..."
          emptyMessage="Nenhuma etapa"
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

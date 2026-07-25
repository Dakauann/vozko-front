"use client";

import { forwardRef } from "react";
import {
  MagnifyingGlass,
  CaretUp,
  CaretDown,
  X,
  FunnelSimple,
  Check,
} from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface WorkflowSearchTypeOption {
  value: string;
  label: string;
}

export interface WorkflowSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** Number of nodes matching the query. */
  matchCount: number;
  /** Current cursor within the matches (0-based), or -1 when none is focused. */
  activeIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  /** Node types present on the canvas, for the "filter by type" control. */
  types: WorkflowSearchTypeOption[];
  /** Active type filter (a node type value), or null for "any type". */
  typeFilter: string | null;
  onTypeFilterChange: (type: string | null) => void;
}

// A canvas find-bar (Ctrl+F). Matches any node by id, label, type, or configured
// value, and can be narrowed to a single node type. A lone match is focused
// automatically; multiple matches are all highlighted and cycled with Enter /
// the arrows.
export const WorkflowSearch = forwardRef<HTMLInputElement, WorkflowSearchProps>(
  function WorkflowSearch(
    {
      query,
      onQueryChange,
      matchCount,
      activeIndex,
      onNext,
      onPrev,
      onClose,
      types,
      typeFilter,
      onTypeFilterChange,
    },
    ref,
  ) {
    const hasQuery = query.trim().length > 0;
    const activeType = types.find((t) => t.value === typeFilter) ?? null;
    const showStatus = hasQuery || typeFilter != null;
    const status = !showStatus
      ? null
      : matchCount === 0
        ? "Nenhum nó"
        : activeIndex >= 0
          ? `${activeIndex + 1} de ${matchCount}`
          : `${matchCount} ${matchCount === 1 ? "nó" : "nós"}`;

    return (
      <div className="flex items-center gap-1 rounded-xl border border-border bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur">
        <MagnifyingGlass
          size={15}
          className="ml-0.5 shrink-0 text-muted-foreground"
        />
        <input
          ref={ref}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) onPrev();
              else onNext();
            }
          }}
          placeholder="Buscar nós por nome, tipo ou conteúdo"
          className="w-60 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          aria-label="Buscar nós"
        />

        {status && (
          <span
            className={cn(
              "shrink-0 whitespace-nowrap px-1 text-xs tabular-nums",
              matchCount === 0 ? "text-rose-500" : "text-muted-foreground",
            )}
          >
            {status}
          </span>
        )}

        <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

        {/* Filter by node type */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Filtrar por tipo de nó"
              className={cn(
                "flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium transition-colors",
                activeType
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <FunnelSimple size={13} weight="bold" />
              <span className="max-w-[120px] truncate">
                {activeType ? activeType.label : "Tipo"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
            <DropdownMenuItem
              className="rounded-lg border-l-0"
              onSelect={() => onTypeFilterChange(null)}
            >
              <span className="flex-1">Todos os tipos</span>
              {typeFilter == null && <Check size={16} weight="bold" />}
            </DropdownMenuItem>
            {types.map((t) => (
              <DropdownMenuItem
                key={t.value}
                className="rounded-lg border-l-0"
                onSelect={() => onTypeFilterChange(t.value)}
              >
                <span className="flex-1 truncate">{t.label}</span>
                {typeFilter === t.value && <Check size={16} weight="bold" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {matchCount > 1 && (
          <div className="flex items-center">
            <button
              type="button"
              onClick={onPrev}
              title="Anterior (Shift+Enter)"
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CaretUp size={13} weight="bold" />
            </button>
            <button
              type="button"
              onClick={onNext}
              title="Próximo (Enter)"
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CaretDown size={13} weight="bold" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          title="Fechar (Esc)"
          className="ml-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={13} weight="bold" />
        </button>
      </div>
    );
  },
);

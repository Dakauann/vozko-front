"use client";

import { CaretDown, Check } from "@/components/icons";

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
import { cn } from "@/lib/utils";
import { useState } from "react";

/**
 * One option of a checklist filter. `count` is how many records carry this
 * value within the CURRENT filtered set — the server's facet count — and is
 * omitted when the caller has none to show.
 */
export interface FilterMultiSelectOption {
  value: string;
  label: string;
  color?: string;
  count?: number;
}

export interface FilterMultiSelectProps {
  triggerLabel: string;
  icon: React.ReactNode;
  options: FilterMultiSelectOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  searchPlaceholder: string;
  emptyMessage: string;
  /** Localized label for the "clear this control" affordance. */
  clearLabel?: string;
  className?: string;
}

// A quiet neutral dropdown checklist (Popover + cmdk). Reuses the same
// primitives the house selects are built on; state shows as a count badge and
// per-row checks, never a colored pill.
export function FilterMultiSelect({
  triggerLabel,
  icon,
  options,
  selected,
  onToggle,
  onClear,
  searchPlaceholder,
  emptyMessage,
  clearLabel = "Limpar",
  className,
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
            className,
            active
              ? "border-primary/40 text-foreground"
              : "border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted",
          )}
        >
          <span className="text-muted-foreground">{icon}</span>
          <span>{triggerLabel}</span>
          {active ? (
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-[--radius] bg-primary px-1.5 text-2xs font-semibold text-primary-foreground">
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
          <span className="text-2xs font-semibold text-muted-foreground">
            {triggerLabel}
          </span>
          {active ? (
            <button
              type="button"
              onClick={onClear}
              className="text-2xs font-medium text-primary-ink transition-colors hover:text-[hsl(var(--primary-hover))]"
            >
              {clearLabel}
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
                    {typeof option.count === "number" ? (
                      // The count comes from the server's facet pass over the
                      // SAME filtered set the rows come from, so "0" here means
                      // "adding this narrows to nothing", not "no data".
                      <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                        {option.count}
                      </span>
                    ) : null}
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

"use client";

import { ElevatedCommandSelect, type ElevatedCommandOption } from "@/components/elevated-design/elevated-command-select";
import { CheckCircle, X } from "@/components/icons";

export interface PickedEntry {
  id: string;
  name: string;
}

export function MultiPickField({
  label,
  searchPlaceholder,
  emptyMessage,
  options,
  isLoading,
  onSearch,
  onScrollEnd,
  onOpenChange,
  picked,
  onPick,
  onRemove,
  removeLabel,
  disabled,
}: {
  label: string;
  searchPlaceholder: string;
  emptyMessage: string;
  options: ElevatedCommandOption[];
  isLoading: boolean;
  onSearch?: (query: string) => void;
  onScrollEnd: () => void;
  onOpenChange: (open: boolean) => void;
  picked: PickedEntry[];
  onPick: (entry: PickedEntry) => void;
  onRemove: (id: string) => void;
  removeLabel: (name: string) => string;
  disabled?: boolean;
}) {
  const pickedIds = new Set(picked.map((entry) => entry.id));
  const marked = options.map((option) =>
    pickedIds.has(option.value)
      ? { ...option, disabled: true, meta: <CheckCircle aria-hidden className="h-4 w-4 text-healthy-ink" weight="fill" /> }
      : option,
  );

  return (
    <div className="space-y-2">
      <ElevatedCommandSelect
        label={label}
        options={marked}
        value={null}
        onValueChange={(value, option) => onPick({ id: value, name: option.label })}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
        isLoading={isLoading}
        onSearch={onSearch}
        onScrollEnd={onScrollEnd}
        onOpenChange={onOpenChange}
        disabled={disabled}
        fullWidth
      />
      {picked.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {picked.map((entry) => (
            <li key={entry.id} className="inline-flex max-w-full items-center gap-1 rounded-[--radius] border border-border bg-card py-0.5 pl-2 pr-0.5 text-xs text-foreground">
              <span className="truncate">{entry.name}</span>
              <button
                type="button"
                onClick={() => onRemove(entry.id)}
                aria-label={removeLabel(entry.name)}
                title={removeLabel(entry.name)}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-accent-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

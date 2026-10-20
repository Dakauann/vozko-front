"use client";

import { useState, type ReactNode } from "react";

import { BULK_CONTROL } from "@/components/selection/GuardedAction";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface BulkMenuOption {
  value: string;
  label: string;
  color?: string;
}

interface BulkMenuProps {
  triggerLabel: string;
  icon: ReactNode;
  heading: string;
  searchPlaceholder: string;
  emptyMessage: string;
  options: BulkMenuOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  tone?: "default" | "ghost";
}

export function BulkMenu({
  triggerLabel,
  icon,
  heading,
  searchPlaceholder,
  emptyMessage,
  options,
  onSelect,
  disabled,
  tone = "default",
}: BulkMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={
            tone === "ghost"
              ? "inline-flex h-8 items-center gap-1.5 rounded-[--radius] px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground"
              : BULK_CONTROL
          }
        >
          <span className="text-muted-foreground">{icon}</span>
          <span>{triggerLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-64 rounded-[--radius] border border-border bg-card p-0 shadow-2xl">
        <div className="border-b border-border px-3 py-2">
          <span className="text-2xs font-semibold text-muted-foreground">{heading}</span>
        </div>
        <Command shouldFilter className="rounded-none bg-transparent text-foreground">
          <CommandInput placeholder={searchPlaceholder} className="text-sm" />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.value} ${option.label}`.toLowerCase()}
                  onSelect={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs text-foreground data-[selected=true]:bg-muted"
                >
                  {option.color ? (
                    <span className="h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-black/5" style={{ backgroundColor: option.color }} />
                  ) : null}
                  <span className="flex-1 truncate font-medium">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

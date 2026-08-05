"use client";

import * as React from "react";
import { useState, useEffect, type ReactNode } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { Command as CommandIcon } from "@/components/icons";

interface CommandPaletteProps {
  items: {
    id: string;
    label: string;
    icon?: ReactNode;
    onSelect?: () => void;
    group?: string;
    shortcut?: string;
    render?: () => ReactNode; 
  }[];
  placeholder?: string;
  trigger?: ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export default function CommandPalette({
  items,
  placeholder = "Type a command or search...",
  trigger,
  onOpenChange,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const groupedItems = React.useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const group = item.group || "Suggestions";
        if (!acc[group]) acc[group] = [];
        acc[group].push(item);
        return acc;
      },
      {} as Record<string, typeof items>,
    );
  }, [items]);

  const handleSelect = (item: (typeof items)[0]) => {
    item.onSelect?.();
    setOpen(false);
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex justify-between w-full p-[14px] border border-border bg-transparent rounded-full text-foreground placeholder:text-transparent focus:outline-none focus:shadow-sm focus:border-foreground/20 transition-all duration-200"
          style={{
            boxShadow:
              "var(--elev-1)",
          }}
          type="button"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{placeholder}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CommandIcon className="w-3 h-3" weight="bold" />
            <span>K</span>
          </div>
        </button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={placeholder} />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {Object.entries(groupedItems).map(([group, groupItems]) => (
            <CommandGroup key={group} heading={group}>
              {groupItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  onSelect={() => handleSelect(item)}
                >
                  {item.render ? (
                    item.render()
                  ) : (
                    <>
                      {item.icon && (
                        <span
                          className="mr-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.icon}
                        </span>
                      )}
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <CommandShortcut>{item.shortcut}</CommandShortcut>
                      )}
                    </>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}

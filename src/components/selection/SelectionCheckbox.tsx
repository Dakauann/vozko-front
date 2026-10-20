"use client";

import type { MouseEvent } from "react";

import { Check, Minus } from "@/components/icons";
import { cn } from "@/lib/utils";

export type SelectionCheckState = boolean | "mixed";

interface SelectionCheckboxProps {
  checked: SelectionCheckState;
  label: string;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  tabIndex?: number;
}

export function SelectionCheckbox({ checked, label, onToggle, tabIndex }: SelectionCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      tabIndex={tabIndex}
      onClick={onToggle}
      className={cn(
        "relative flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150 ease-out motion-reduce:transition-none",
        "after:absolute after:-inset-2 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-control-edge bg-card hover:border-foreground/60",
      )}
    >
      {checked === "mixed" ? <Minus weight="bold" className="h-3 w-3" aria-hidden /> : null}
      {checked === true ? <Check weight="bold" className="h-3 w-3" aria-hidden /> : null}
    </button>
  );
}

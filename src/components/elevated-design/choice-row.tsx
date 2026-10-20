"use client";

import { useId, type ReactNode } from "react";

import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export function ChoiceRow({
  value,
  title,
  hint,
  icon,
  aside,
  disabled,
}: {
  value: string;
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  aside?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-[--radius] border border-border px-3 py-2.5 transition-colors has-[[data-state=checked]]:border-control-edge has-[[data-state=checked]]:bg-muted",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted",
      )}
    >
      <RadioGroupItem
        id={id}
        value={value}
        disabled={disabled}
        aria-labelledby={`${id}-title`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5"
      />
      {icon ? <span className="mt-0.5 text-muted-foreground">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span id={`${id}-title`} className="text-sm font-medium text-foreground">
            {title}
          </span>
          {aside}
        </span>
        {hint ? (
          <span id={`${id}-hint`} className="block text-xs text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

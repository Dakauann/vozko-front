"use client";

import * as React from "react";

import { ElevatedSwitch as Switch } from "@/components/elevated-design/elevated-switch";

export function SettingSwitchRow({
  label,
  hint,
  checked,
  disabled,
  describedBy,
  reason,
  onCheckedChange,
  stamp,
  children,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  describedBy?: string;
  reason?: string;
  onCheckedChange: (value: boolean) => void;
  stamp: React.ReactNode;
  children?: React.ReactNode;
}) {
  const hintId = React.useId();
  const reasonId = React.useId();
  return (
    <div className="space-y-3 rounded-[--radius] border border-border px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1 pr-4">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
          {reason ? (
            <p id={reasonId} className="text-xs font-medium text-foreground">
              {reason}
            </p>
          ) : null}
          {stamp}
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-label={label}
          aria-describedby={[hintId, reason ? reasonId : null, describedBy].filter(Boolean).join(" ")}
        />
      </div>
      {children}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

import type { KeyState } from "@/lib/studio/keyframe-edit";

import { ToolButton } from "../tool-button";

interface KeyToggleProps {
  label: string;
  state: KeyState;
  disabled: boolean;
  onClick: () => void;
}

export function KeyToggle({ label, state, disabled, onClick }: KeyToggleProps) {
  return (
    <ToolButton
      size="sm"
      label={label}
      pressed={state === "key"}
      disabled={disabled}
      onClick={onClick}
      icon={
        <svg viewBox="0 0 10 10" aria-hidden className="h-2.5 w-2.5">
          <path d="M5 0.8 9.2 5 5 9.2 0.8 5Z" fill={state === "static" ? "none" : "currentColor"} fillOpacity={state === "interpolated" ? 0.35 : 1} stroke="currentColor" strokeWidth="1.2" />
        </svg>
      }
    />
  );
}

export function KeyedField({ toggle, children }: { toggle: KeyToggleProps; children: ReactNode }) {
  return (
    <div className="flex items-end gap-1">
      <div className="min-w-0 flex-1">{children}</div>
      <KeyToggle {...toggle} />
    </div>
  );
}

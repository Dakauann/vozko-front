"use client";

import type { ReactNode } from "react";
import {
  ElevatedPillToggle,
  type ElevatedPillOption,
} from "@/components/elevated-design/elevated-pill-toggle";

export interface CrmSegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface CrmSegmentedToggleProps<T extends string> {
  options: CrmSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Render without the sunk track, for use inside a ConsoleBank. */
  bare?: boolean;
}

/**
 * CRM toolbar pill toggle. Shared surface with date presets / live-chat filters
 * via ElevatedPillToggle (Signal Blue active segment).
 */
export default function CrmSegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  className,
  bare,
}: CrmSegmentedToggleProps<T>) {
  const mapped: ElevatedPillOption<T>[] = options.map((opt) => ({
    value: opt.value,
    label: opt.label,
    icon: opt.icon,
  }));

  return (
    <ElevatedPillToggle
      bare={bare}
      className={className}
      options={mapped}
      value={value}
      onChange={onChange}
      size="md"
      collapseLabels="md"
    />
  );
}

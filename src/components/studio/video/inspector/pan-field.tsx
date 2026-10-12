"use client";

import { useTranslations } from "next-intl";

import type { KeyState } from "@/lib/studio/keyframe-edit";

import { SliderField } from "./fields";

const PERCENT = 100;

export function usePanText(): (pan: number) => string {
  const t = useTranslations("studio.video.sound");
  return (pan) => {
    const shown = Math.round(pan * PERCENT);
    if (shown === 0) return t("panCenter");
    return shown < 0 ? t("panLeft", { value: -shown }) : t("panRight", { value: shown });
  };
}

interface PanFieldProps {
  label: string;
  value: number | null;
  disabled?: boolean;
  onChange: (pan: number) => void;
  onStart: () => void;
  onCommit: () => void;
  keyState?: KeyState;
  keyHint?: string;
}

export function PanField({ label, value, disabled, onChange, onStart, onCommit, keyState, keyHint }: PanFieldProps) {
  const panText = usePanText();
  return (
    <SliderField
      label={label}
      min={-PERCENT}
      max={PERCENT}
      step={1}
      value={value === null ? null : Math.round(value * PERCENT)}
      fallback={0}
      valueText={panText(value ?? 0)}
      disabled={disabled}
      onChange={(shown) => onChange(shown / PERCENT)}
      onStart={onStart}
      onCommit={onCommit}
      keyState={keyState}
      keyHint={keyHint}
    />
  );
}

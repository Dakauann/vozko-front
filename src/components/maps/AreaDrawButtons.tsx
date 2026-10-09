"use client";

import { useId, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

import { Area, Radius, Rectangle, X, type Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { AreaKind } from "@/lib/maps/types";

import { MAP_CONTROL_BUTTON, MAP_CONTROL_BUTTON_ON } from "./map-layout";

export type DrawMode = AreaKind;

const MODES: Array<{ mode: DrawMode; icon: Icon }> = [
  { mode: "polygon", icon: Area },
  { mode: "rectangle", icon: Rectangle },
  { mode: "circle", icon: Radius },
];

export interface AreaDrawButtonsProps {
  activeMode: DrawMode | null;
  onSelectMode: (mode: DrawMode) => void;
  onCancel: () => void;
  disabled?: boolean;
  error?: string | null;
  className?: string;
}

export function AreaDrawButtons({ activeMode, onSelectMode, onCancel, disabled = false, error = null, className }: AreaDrawButtonsProps) {
  const t = useTranslations("leadMap.draw");
  const hintId = useId();

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && activeMode) {
      event.stopPropagation();
      onCancel();
    }
  };

  const message = error ?? (activeMode ? t(`hint.${activeMode}`) : null);

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        role="toolbar"
        aria-label={t("toolbar")}
        aria-describedby={message ? hintId : undefined}
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-0.5"
      >
        {MODES.map(({ mode, icon: ModeIcon }) => {
          const active = activeMode === mode;
          return (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              title={t(mode)}
              onClick={() => (active ? onCancel() : onSelectMode(mode))}
              className={cn(MAP_CONTROL_BUTTON, active && MAP_CONTROL_BUTTON_ON)}
            >
              <ModeIcon size={16} aria-hidden="true" />
              <span className="sr-only">{t(mode)}</span>
            </button>
          );
        })}
        {activeMode ? (
          <button
            type="button"
            onClick={onCancel}
            title={t("cancel")}
            className={MAP_CONTROL_BUTTON}
          >
            <X size={16} aria-hidden="true" />
            <span className="sr-only">{t("cancel")}</span>
          </button>
        ) : null}
      </div>
      <p
        id={hintId}
        aria-live="polite"
        className={cn(
          "absolute left-0 top-full mt-2 w-64 rounded-[--radius] border border-border-strong bg-card px-2.5 py-1.5 text-xs shadow-lg",
          error ? "text-destructive-ink" : "text-muted-foreground",
          !message && "sr-only",
        )}
      >
        {message}
      </p>
    </div>
  );
}

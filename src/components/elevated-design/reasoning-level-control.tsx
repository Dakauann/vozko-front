"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, Lightbulb, X } from "@/components/icons";
import { displayedReasoning, isReasoningLevel, type ReasoningAdjustment, type ReasoningOptions } from "@/lib/ai-models/reasoning";
import { cn } from "@/lib/utils";

const TOOLBAR_SELECT =
  "h-8 appearance-none rounded-[--radius] bg-transparent pl-7 pr-6 text-sm font-medium text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";
const FIELD_SELECT =
  "h-9 w-full appearance-none rounded-[--radius] border border-border bg-muted pl-8 pr-8 text-sm font-medium text-foreground transition-colors hover:border-control-edge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

interface ReasoningLevelControlProps {
  options: ReasoningOptions | undefined;
  value: string;
  onChange: (level: string) => void;
  adjusted?: ReasoningAdjustment | null;
  onAcknowledge?: () => void;
  disabled?: boolean;
  variant?: "field" | "toolbar";
}

export function ReasoningLevelControl({ options, value, onChange, adjusted, onAcknowledge, disabled, variant = "field" }: ReasoningLevelControlProps) {
  const t = useTranslations("modelPicker.reasoning");
  const id = useId();
  const shown = displayedReasoning(options, value);
  const toolbar = variant === "toolbar";
  const levelName = (level: string) => (isReasoningLevel(level) ? t(`levels.${level}`) : level);

  const notice = adjusted ? (
    <p
      role="status"
      className={cn(
        "flex items-start gap-1.5 rounded-[--radius] border border-border bg-card px-2.5 py-1.5 text-xs text-foreground shadow-sm",
        toolbar && "absolute bottom-full left-0 z-20 mb-1 w-64",
        !toolbar && "mt-1.5",
      )}
    >
      <span className="min-w-0 flex-1">
        {adjusted.to ? t("adjusted", { level: levelName(adjusted.to), previous: levelName(adjusted.from) }) : t("adjustedOff", { previous: levelName(adjusted.from) })}
      </span>
      {onAcknowledge ? (
        <button type="button" onClick={onAcknowledge} aria-label={t("dismiss")} className="flex-shrink-0 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </p>
  ) : null;

  if (!options || !shown) {
    return notice ? <div className="relative">{notice}</div> : null;
  }

  return (
    <div className={cn("relative", toolbar ? "flex min-w-0 flex-shrink-0 items-center" : "w-full")}>
      {toolbar ? null : (
        <label htmlFor={id} className="legend mb-1 block">
          {t("label")}
        </label>
      )}
      <div className="relative flex items-center">
        <Lightbulb className={cn("pointer-events-none absolute h-4 w-4 text-muted-foreground", toolbar ? "left-2" : "left-2.5")} aria-hidden />
        <select
          id={id}
          aria-label={toolbar ? t("label") : undefined}
          title={toolbar ? t("label") : undefined}
          value={shown}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={toolbar ? TOOLBAR_SELECT : FIELD_SELECT}
        >
          {options.levels.map((level) => (
            <option key={level} value={level}>
              {level === options.default ? t("defaultLevel", { level: levelName(level) }) : levelName(level)}
            </option>
          ))}
        </select>
        <CaretDown className={cn("pointer-events-none absolute h-3.5 w-3.5 text-muted-foreground", toolbar ? "right-1.5" : "right-2.5")} weight="bold" aria-hidden />
      </div>
      {notice}
    </div>
  );
}

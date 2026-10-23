"use client";

import { useTranslations } from "next-intl";

import { Check } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface WizardStepBarProps<S extends string> {
  steps: readonly S[];
  current: S;
  labelOf: (step: S) => string;
  onSelect: (step: S) => void;
  enabled: boolean;
}

export function WizardStepBar<S extends string>({ steps, current, labelOf, onSelect, enabled }: WizardStepBarProps<S>) {
  const t = useTranslations("campaignWizard.steps");
  const index = steps.indexOf(current);
  return (
    <nav aria-label={t("label")} className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1">
        {steps.map((step, position) => {
          const state = position < index ? "done" : position === index ? "active" : "upcoming";
          return (
            <li key={step} className="flex items-center gap-1">
              <button
                type="button"
                disabled={!enabled && step !== current}
                aria-current={state === "active" ? "step" : undefined}
                onClick={() => onSelect(step)}
                className={cn(
                  "flex items-center gap-2 rounded-[--radius] px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                  state === "active" ? "bg-muted font-semibold text-foreground shadow-[inset_0_-2px_0_0_hsl(var(--primary))]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold tabular-nums",
                    state === "done" && "bg-primary text-primary-foreground shadow-button-primary",
                    state === "active" && "border-2 border-primary-edge bg-card text-foreground",
                    state === "upcoming" && "border border-control-edge bg-card text-muted-foreground",
                  )}
                >
                  {state === "done" ? <Check className="h-3 w-3" weight="bold" /> : position + 1}
                </span>
                {labelOf(step)}
              </button>
              {position < steps.length - 1 ? <span aria-hidden className="h-px w-6 bg-border-strong" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

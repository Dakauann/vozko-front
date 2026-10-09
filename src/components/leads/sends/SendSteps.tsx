"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";

import { Check } from "@/components/icons";
import { cn } from "@/lib/utils";

export function SendSteps({ steps, current }: { steps: readonly string[]; current: number }) {
  const t = useTranslations("leadSends.steps");
  return (
    <ol aria-label={t("label")} className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
      {steps.map((step, index) => {
        const done = index < current;
        const on = index === current;
        return (
          <Fragment key={step}>
            {index > 0 ? <li aria-hidden className="h-px w-7 bg-border-strong" /> : null}
            <li aria-current={on ? "step" : undefined} className={cn("flex items-center gap-1.5", on && "text-foreground")}>
              <span
                aria-hidden
                className={cn(
                  "grid size-5 place-items-center rounded-full border border-control-edge text-2xs",
                  done && "bg-muted text-foreground",
                  on && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {done ? <Check className="size-3" /> : index + 1}
              </span>
              {step}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

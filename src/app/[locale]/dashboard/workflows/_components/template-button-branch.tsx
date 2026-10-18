"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import {
  TEMPLATE_BUTTON_POSITIONS,
  templateButtonCondition,
  templateButtonIndexOf,
  type TemplateButtonCondition,
} from "@/lib/workflows/template-button";
import { cn } from "@/lib/utils";

export function TemplateButtonBranchField({
  config,
  onApply,
}: {
  config: Record<string, unknown>;
  onApply: (condition: TemplateButtonCondition) => void;
}) {
  const t = useTranslations("workflowsPage.templateButton");
  const titleId = useId();
  const current = templateButtonIndexOf(config);

  return (
    <section aria-labelledby={titleId} className="space-y-2 rounded-[--radius] border border-border bg-card p-3">
      <div>
        <p id={titleId} className="text-xs font-medium text-foreground">
          {t("title")}
        </p>
        <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{t("hint")}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_BUTTON_POSITIONS.map((index) => (
          <button
            key={index}
            type="button"
            aria-pressed={current === index}
            onClick={() => onApply(templateButtonCondition(index))}
            className={cn(
              "rounded-[--radius] border px-2 py-1 text-2xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              current === index
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted",
            )}
          >
            {t("position", { position: index + 1 })}
          </button>
        ))}
      </div>
      {current !== null ? <p className="text-2xs text-muted-foreground">{t("active", { position: current + 1 })}</p> : null}
    </section>
  );
}

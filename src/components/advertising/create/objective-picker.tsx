"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { CheckCircle } from "@/components/icons";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { AdObjective, AdsOptions } from "@/lib/advertising/draft-types";
import { OBJECTIVES, routesFor } from "@/lib/advertising/wizard-routes";
import { cn } from "@/lib/utils";

import { OBJECTIVE_ICONS } from "../wizard/objective-fields";

function ObjectiveRow({
  objective,
  disabled,
  onHover,
}: {
  objective: AdObjective;
  disabled: boolean;
  onHover: (objective: AdObjective | null) => void;
}) {
  const t = useTranslations("adsWizard.objective.objectives");
  const id = useId();
  const ObjectiveIcon = OBJECTIVE_ICONS[objective];
  return (
    <label
      htmlFor={id}
      onMouseEnter={() => onHover(objective)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "flex items-center gap-3 rounded-[--radius] px-3 py-2.5 transition-colors has-[[data-state=checked]]:bg-muted",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted",
      )}
    >
      <RadioGroupItem id={id} value={objective} disabled={disabled} onFocus={() => onHover(objective)} />
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
        <ObjectiveIcon className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-sm font-medium text-foreground">{t(`${objective}.title`)}</span>
    </label>
  );
}

function ObjectiveDetails({ objective }: { objective: AdObjective | "" }) {
  const t = useTranslations("adsCreate");
  const tTitles = useTranslations("adsWizard.objective.objectives");
  if (!objective) {
    return <p className="text-sm text-muted-foreground">{t("pickObjectiveHint")}</p>;
  }
  const ObjectiveIcon = OBJECTIVE_ICONS[objective];
  const goodFor = t.raw(`objectives.${objective}.goodFor`) as string[];
  return (
    <div className="space-y-3">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground">
        <ObjectiveIcon className="h-6 w-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-display text-base font-semibold text-foreground">{tTitles(`${objective}.title`)}</p>
        <p className="text-sm text-muted-foreground">{t(`objectives.${objective}.description`)}</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{t("goodFor")}</p>
        <ul className="flex flex-wrap gap-1.5">
          {goodFor.map((item) => (
            <li key={item} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground">
              <CheckCircle className="h-3.5 w-3.5 text-healthy-ink" weight="fill" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ObjectivePicker({
  options,
  value,
  onChange,
}: {
  options: AdsOptions | null;
  value: AdObjective | "";
  onChange: (objective: AdObjective) => void;
}) {
  const t = useTranslations("adsCreate");
  const [hovered, setHovered] = useState<AdObjective | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{t("objectiveTitle")}</p>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
        <RadioGroup value={value} onValueChange={(next) => onChange(next as AdObjective)} className="gap-0.5" aria-label={t("objectiveTitle")}>
          {OBJECTIVES.map((objective) => (
            <ObjectiveRow key={objective} objective={objective} disabled={!!options && routesFor(options, objective).length === 0} onHover={setHovered} />
          ))}
        </RadioGroup>
        <div className="rounded-[--radius] border border-border bg-muted/40 p-4">
          <ObjectiveDetails objective={hovered ?? value} />
        </div>
      </div>
    </div>
  );
}

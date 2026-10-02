"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { PencilSimple } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { inputToMinor, minorToInput } from "@/lib/advertising/money";
import type { AdBudgetMinimum } from "@/lib/advertising/types";

import { BudgetMinimumHint, useBudgetMinimum, type BudgetMinimumQuery } from "./budget-minimum";
import { useAdsFormat } from "./use-ads-format";

export function BudgetCell({
  dailyBudget,
  lifetimeBudget,
  currency,
  editable,
  minimumQuery,
  onSave,
}: {
  dailyBudget: number;
  lifetimeBudget: number;
  currency: string;
  editable: boolean;
  minimumQuery: BudgetMinimumQuery | null;
  onSave: (amount: number, minimum: AdBudgetMinimum | null) => Promise<string | null>;
}) {
  const t = useTranslations("adsManager.budget");
  const fmt = useAdsFormat();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minimum = useBudgetMinimum(open && dailyBudget > 0 ? minimumQuery : null);

  if (dailyBudget <= 0 && lifetimeBudget <= 0) {
    return <span className="text-sm text-muted-foreground">{t("adSetBudget")}</span>;
  }

  const daily = dailyBudget > 0;
  const current = daily ? dailyBudget : lifetimeBudget;
  const value = (
    <span className="flex flex-col">
      <span className="text-sm tabular-nums text-foreground">{fmt.minor(current, currency)}</span>
      <span className="text-2xs text-muted-foreground">{daily ? t("daily") : t("lifetime")}</span>
    </span>
  );

  if (!editable) return value;

  const parsed = inputToMinor(input, currency);

  const openEditor = (next: boolean) => {
    if (saving) return;
    setOpen(next);
    if (next) {
      setInput(minorToInput(current, currency));
      setError(null);
    }
  };

  const save = async () => {
    if (saving || parsed === null || parsed === current) return;
    setSaving(true);
    setError(null);
    const failure = await onSave(parsed, minimum);
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={openEditor}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          className="group/budget -mx-1 inline-flex items-start gap-1.5 rounded-[--radius] px-1 py-0.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("edit")}
        >
          {value}
          <PencilSimple className="mt-0.5 h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/budget:opacity-100 group-focus-visible/budget:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3" onClick={(event) => event.stopPropagation()}>
        <p className="text-sm font-semibold text-foreground">{t("edit")}</p>
        <ElevatedInput
          label={t(daily ? "dailyLabel" : "lifetimeLabel", { currency })}
          inputMode="decimal"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
          }}
          error={error ?? (input && parsed === null ? t("invalid") : undefined)}
          controlSize="sm"
          autoFocus
        />
        {daily ? <BudgetMinimumHint minimum={minimum} /> : null}
        <p className="text-xs text-muted-foreground">{t("limitHint")}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" title={t("cancel")} onClick={() => setOpen(false)} disabled={saving} />
          <Button
            variant="primary"
            size="sm"
            title={saving ? t("saving") : t("save")}
            onClick={() => void save()}
            disabled={saving || parsed === null || parsed === current}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

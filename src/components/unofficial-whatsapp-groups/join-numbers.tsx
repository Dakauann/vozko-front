"use client";

import { useMemo, useState } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";

import { Notice } from "@/components/ui/notice";
import { defaultJoinNumbers, joinSchedule } from "@/lib/unofficial-whatsapp-groups/join-plan";
import { JOIN_SPACING_MINUTES } from "@/lib/unofficial-whatsapp-groups/types";

import { NumberPicker, NumberPickerSkeleton } from "./number-picker";
import { numberLabel, useWorkspaceNumbers } from "./use-workspace-numbers";

export function useJoinNumbers(alreadyIn: string[]) {
  const t = useTranslations("unofficialGroups.join");
  const { numbers, loading, error } = useWorkspaceNumbers();
  const [picked, setPicked] = useState<string[] | null>(null);
  const now = useNow({ updateInterval: 30_000 });

  const selected = useMemo(() => {
    const chosen = picked ?? defaultJoinNumbers(numbers, alreadyIn);
    const inside = new Set(alreadyIn);
    const allowed = new Set(numbers.filter((number) => number.sessionLive && !inside.has(number.id)).map((number) => number.id));
    return numbers.map((number) => number.id).filter((id) => chosen.includes(id) && allowed.has(id));
  }, [picked, numbers, alreadyIn]);

  const schedule = useMemo(() => joinSchedule(selected, now, JOIN_SPACING_MINUTES), [selected, now]);
  const labels = useMemo(() => new Map(numbers.map((number) => [number.id, numberLabel(number)])), [numbers]);

  const options = useMemo(
    () =>
      numbers.map((number) => {
        const inside = alreadyIn.includes(number.id);
        return {
          number,
          disabled: inside || !number.sessionLive,
          note: inside ? t("alreadyIn") : number.sessionLive ? undefined : t("offline"),
        };
      }),
    [numbers, alreadyIn, t],
  );

  const toggle = (id: string) => {
    setPicked(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  return { loading, error, empty: !loading && numbers.length === 0, selected, toggle, options, labels, schedule };
}

export type JoinNumbers = ReturnType<typeof useJoinNumbers>;

export function JoinNumbersFields({ join }: { join: JoinNumbers }) {
  const t = useTranslations("unofficialGroups.join");
  const format = useFormatter();
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold text-muted-foreground">{t("numbers")}</legend>
        {join.error ? <Notice tone="fault">{join.error}</Notice> : null}
        {join.empty && !join.error ? <Notice tone="warning">{t("noNumbers")}</Notice> : null}
        {join.loading ? (
          <NumberPickerSkeleton />
        ) : (
          <NumberPicker label={t("numbers")} options={join.options} selected={join.selected} onToggle={join.toggle} />
        )}
      </fieldset>

      {join.schedule.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">{t("scheduleTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("scheduleHint", { minutes: JOIN_SPACING_MINUTES })}</p>
          <ol className="divide-y divide-border rounded-[--radius] border border-border">
            {join.schedule.map((slot, index) => (
              <li key={slot.instanceId} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="readout w-5 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                  <span className="truncate text-sm text-foreground">{join.labels.get(slot.instanceId)}</span>
                </span>
                <span className="readout shrink-0 text-xs text-muted-foreground">
                  {index === 0 ? t("now") : t("at", { time: format.dateTime(slot.at, { timeStyle: "short" }) })}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useTranslations } from "next-intl";

import { isRecordEdit, leadActionSkipRows } from "@/lib/leads/actions";

export interface LeadActionCountsProps {
  action: string;
  selected: number;
  eligible: number;
  skipped: Record<string, number>;
}

export function LeadActionCountRows({ action, selected, eligible, skipped }: LeadActionCountsProps) {
  const t = useTranslations("leadsPage.bulk");
  const eligibleKey = `dialog.counts.eligible.${isRecordEdit(action) ? "edit" : action}`;
  return (
    <>
      <CountRow label={t("dialog.counts.selected")} count={selected} strong />
      {t.has(eligibleKey) ? <CountRow label={t(eligibleKey)} count={eligible} strong /> : null}
      {leadActionSkipRows(action, skipped).map(({ reason, count }) => (
        <CountRow key={reason} label={t.has(`skipped.${reason}`) ? t(`skipped.${reason}`) : t("skipped.other")} count={count} />
      ))}
    </>
  );
}

function CountRow({ label, count, strong = false }: { label: string; count: number; strong?: boolean }) {
  const t = useTranslations("leadsPage.bulk");
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "text-right font-semibold tabular-nums text-foreground" : "text-right tabular-nums text-foreground"}>
        {t("dialog.counts.number", { count })}
      </dd>
    </>
  );
}

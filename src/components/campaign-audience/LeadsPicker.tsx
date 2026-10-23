"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { CheckSquare, Funnel, Users } from "@/components/icons";
import LeadSavedViews from "@/components/leads/LeadSavedViews";
import { LeadsToolbar } from "@/components/leads/LeadsToolbar";
import { Notice } from "@/components/ui/notice";
import type { LeadsPickDraft } from "@/lib/campaign-audience/draft";
import { emptyLeadFilter } from "@/lib/leads/filters";

type ChoosablePick = "filter" | "everyone" | "ids";

const HINT: Record<ChoosablePick, "filterHint" | "everyoneHint" | "idsHint"> = { filter: "filterHint", everyone: "everyoneHint", ids: "idsHint" };

export function LeadsPicker({ value, onChange, readOnly = false }: { value: LeadsPickDraft; onChange: (patch: Partial<LeadsPickDraft>) => void; readOnly?: boolean }) {
  const t = useTranslations("campaignAudience.step.pick");

  if (value.pick === "first_n") {
    return (
      <Notice tone="info" title={t("quantityTitle", { count: value.limit ?? 0 })}>
        <p>{t("quantityBody")}</p>
        {readOnly ? null : <Button variant="secondary" size="sm" title={t("idsSwitch")} onClick={() => onChange({ pick: "filter", limit: undefined, sort: undefined })} />}
      </Notice>
    );
  }

  const pick: ChoosablePick = value.pick;
  const excluded = pick === "ids" ? 0 : (value.excludeIds?.length ?? 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ElevatedPillToggle<ChoosablePick>
          aria-label={t("label")}
          size="md"
          collapseLabels="sm"
          value={pick}
          onChange={(next) => onChange({ pick: next })}
          options={[
            { value: "filter", label: t("filter"), icon: <Funnel className="h-4 w-4" />, disabled: readOnly },
            { value: "everyone", label: t("everyone"), icon: <Users className="h-4 w-4" />, disabled: readOnly },
            { value: "ids", label: t("ids"), icon: <CheckSquare className="h-4 w-4" />, disabled: readOnly },
          ]}
        />
        <p className="text-xs text-muted-foreground">{t(HINT[pick])}</p>
      </div>
      {excluded > 0 ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {t("excluded", { count: excluded })}
          {readOnly ? null : <Button type="button" variant="ghost" size="sm" title={t("restore")} onClick={() => onChange({ excludeIds: [] })} />}
        </p>
      ) : null}
      {pick === "filter" && !readOnly ? (
        <LeadsToolbar
          filter={value.filter}
          onFilterChange={(filter) => onChange({ filter })}
          search={value.search}
          onSearchChange={(search) => onChange({ search })}
          savedViews={
            <LeadSavedViews
              filter={value.filter}
              sorts={[]}
              columns={[]}
              onApply={(view) => onChange({ filter: view.filter ?? emptyLeadFilter, search: "" })}
            />
          }
        />
      ) : null}
    </div>
  );
}

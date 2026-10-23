"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { Funnel, Users } from "@/components/icons";
import LeadSavedViews from "@/components/leads/LeadSavedViews";
import { LeadsToolbar } from "@/components/leads/LeadsToolbar";
import { Notice } from "@/components/ui/notice";
import type { LeadsPickDraft } from "@/lib/campaign-audience/draft";
import { emptyLeadFilter } from "@/lib/leads/filters";

type WidePick = Exclude<LeadsPickDraft["pick"], "ids">;

export function LeadsPicker({ value, onChange, readOnly = false }: { value: LeadsPickDraft; onChange: (patch: Partial<LeadsPickDraft>) => void; readOnly?: boolean }) {
  const t = useTranslations("campaignAudience.step.pick");

  if (value.pick === "ids") {
    return (
      <Notice tone="info" title={t("idsTitle", { count: value.ids.length })}>
        <p>{t("idsBody")}</p>
        {readOnly ? null : <Button variant="secondary" size="sm" title={t("idsSwitch")} onClick={() => onChange({ pick: "filter", ids: [] })} />}
      </Notice>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ElevatedPillToggle<WidePick>
          aria-label={t("label")}
          size="md"
          value={value.pick}
          onChange={(pick) => onChange({ pick })}
          options={[
            { value: "filter", label: t("filter"), icon: <Funnel className="h-4 w-4" />, disabled: readOnly },
            { value: "everyone", label: t("everyone"), icon: <Users className="h-4 w-4" />, disabled: readOnly },
          ]}
        />
        <p className="text-xs text-muted-foreground">{value.pick === "everyone" ? t("everyoneHint") : t("filterHint")}</p>
      </div>
      {(value.excludeIds?.length ?? 0) > 0 ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {t("excluded", { count: value.excludeIds?.length ?? 0 })}
          {readOnly ? null : <Button type="button" variant="ghost" size="sm" title={t("restore")} onClick={() => onChange({ excludeIds: [] })} />}
        </p>
      ) : null}
      {value.pick === "filter" && !readOnly ? (
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

"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { MagnifyingGlass, UserPlus, X } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { chosenLeadsOf, withIncludedLead, withoutChosenLead } from "@/lib/campaign-audience/draft";
import type { AudienceLead, AudienceSpec } from "@/lib/campaign-audience/types";
import { emptyCrmFilter } from "@/lib/crm/board";
import { effectiveLeadFilter } from "@/lib/leads/bulk-selection";
import { cn } from "@/lib/utils";

import { LEAD_STATUS_TONE } from "./AudienceLeadsSheet";
import { useOutReasonText } from "./use-audience-copy";
import { useAudienceLeadsQuery } from "./use-audience-queries";
import type { CampaignAudience } from "./use-campaign-audience";

const SEARCH_SIZE = 8;
const CHOSEN_SIZE = 10;
const SEARCH_SETTLE_MS = 300;

function searchSpecOf(term: string): AudienceSpec | null {
  const trimmed = term.trim();
  if (!trimmed) return null;
  return { source: "leads", selection: { mode: "all_matching", filter: effectiveLeadFilter(emptyCrmFilter, trimmed) } };
}

function chosenSpecOf(ids: readonly string[]): AudienceSpec | null {
  return ids.length > 0 ? { source: "leads", selection: { mode: "ids", ids: [...ids] } } : null;
}

function LeadFacts({ lead, reasonText }: { lead: AudienceLead; reasonText: (reason: string) => string }) {
  const t = useTranslations("campaignAudience.step");
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{lead.name || t("hand.unnamed")}</span>
        <span className="block truncate font-mono text-xs tabular-nums text-muted-foreground">{lead.contact || <EmptyValue />}</span>
      </span>
      <span className="flex min-w-0 shrink-0 flex-col items-end gap-0.5 sm:max-w-[45%] sm:flex-row sm:items-center sm:gap-2">
        <StatusChip tone={LEAD_STATUS_TONE[lead.status]} label={t(`leads.status.${lead.status}`)} className="shrink-0" />
        {lead.reason ? <span className="truncate text-xs text-muted-foreground">{reasonText(lead.reason)}</span> : null}
      </span>
    </>
  );
}

function RowsLoading() {
  return (
    <ul aria-busy className="divide-y divide-border">
      {Array.from({ length: 3 }, (_, index) => (
        <li key={index} className="flex items-center gap-3 py-2.5">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="ml-auto h-5 w-20" />
        </li>
      ))}
    </ul>
  );
}

function LeadSearch({ audience, chosen, onToggle }: { audience: CampaignAudience; chosen: ReadonlySet<string>; onToggle: (leadId: string, on: boolean) => void }) {
  const t = useTranslations("campaignAudience.step.hand");
  const reasonText = useOutReasonText(audience.channel);
  const hintId = useId();
  const [term, setTerm] = useState("");
  const settled = useDebouncedValue(term, SEARCH_SETTLE_MS);
  const spec = useMemo(() => searchSpecOf(settled), [settled]);
  const found = useAudienceLeadsQuery(audience.channel, spec, audience.countedFields, { search: "", page: 1, limit: SEARCH_SIZE });
  const page = spec ? found.data : undefined;
  const items = page?.items ?? [];
  const total = page?.totalItems ?? 0;

  return (
    <div className="space-y-2">
      <ElevatedInput
        type="search"
        aria-label={t("searchLabel")}
        aria-describedby={hintId}
        placeholder={t("searchPlaceholder")}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
        icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
        controlSize="sm"
      />
      <p id={hintId} role="status" className="text-xs text-muted-foreground">
        {!spec ? t("searchHint") : page ? (total > items.length ? t("resultsMore", { shown: items.length, count: total }) : t("results", { count: total })) : ""}
      </p>
      {!spec ? null : found.isError ? (
        <Notice tone="fault" title={t("searchFailed")}>
          <Button type="button" variant="secondary" size="sm" title={t("retry")} onClick={() => void found.refetch()} />
        </Notice>
      ) : !page ? (
        <RowsLoading />
      ) : items.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{t("searchEmpty")}</p>
      ) : (
        <ul aria-label={t("searchLabel")} aria-busy={found.isFetching} className={cn("divide-y divide-border transition-opacity duration-200", found.isPlaceholderData && "opacity-60")}>
          {items.map((lead) => {
            const name = lead.name || t("unnamed");
            const checked = chosen.has(lead.leadId);
            return (
              <li key={lead.leadId}>
                <label className="-mx-2 flex cursor-pointer items-center gap-3 rounded-[--radius] px-2 py-2 transition-colors hover:bg-muted/60 has-[:focus-visible]:bg-muted/60">
                  <Checkbox checked={checked} aria-label={t("pick", { name })} onCheckedChange={(state) => onToggle(lead.leadId, state === true)} />
                  <LeadFacts lead={lead} reasonText={reasonText} />
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChosenLeads({ audience, ids, readOnly, onRemove }: { audience: CampaignAudience; ids: readonly string[]; readOnly: boolean; onRemove: (leadId: string) => void }) {
  const t = useTranslations("campaignAudience.step.hand");
  const reasonText = useOutReasonText(audience.channel);
  const [page, setPage] = useState(1);
  const spec = useMemo(() => chosenSpecOf(ids), [ids]);
  const listed = useAudienceLeadsQuery(audience.channel, spec, audience.countedFields, { search: "", page, limit: CHOSEN_SIZE });
  const data = spec ? listed.data : undefined;
  if (data && data.totalPages > 0 && page > data.totalPages) setPage(data.totalPages);

  if (!spec) return null;
  if (listed.isError) {
    return (
      <Notice tone="fault" title={t("searchFailed")}>
        <Button type="button" variant="secondary" size="sm" title={t("retry")} onClick={() => void listed.refetch()} />
      </Notice>
    );
  }
  if (!data) return <RowsLoading />;
  return (
    <div className="space-y-2">
      <ul aria-busy={listed.isFetching} className={cn("divide-y divide-border transition-opacity duration-200", listed.isPlaceholderData && "opacity-60")}>
        {data.items.map((lead) => (
          <li key={lead.leadId} className="flex items-center gap-3 py-2">
            <LeadFacts lead={lead} reasonText={reasonText} />
            {readOnly ? null : (
              <button
                type="button"
                aria-label={t("remove", { name: lead.name || t("unnamed") })}
                title={t("remove", { name: lead.name || t("unnamed") })}
                onClick={() => onRemove(lead.leadId)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {data.totalPages > 1 ? (
        <nav aria-label={t("page", { page: data.page, total: data.totalPages })} className="flex items-center justify-end gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{t("page", { page: data.page, total: data.totalPages })}</span>
          <Button type="button" variant="ghost" size="sm" title={t("previous")} disabled={data.page <= 1} onClick={() => setPage(data.page - 1)} />
          <Button type="button" variant="ghost" size="sm" title={t("next")} disabled={data.page >= data.totalPages} onClick={() => setPage(data.page + 1)} />
        </nav>
      ) : null}
    </div>
  );
}

function useChoices(audience: CampaignAudience) {
  const ids = chosenLeadsOf(audience.draft);
  const chosen = useMemo(() => new Set(ids), [ids]);
  const toggle = (leadId: string, on: boolean) => audience.update((draft) => (on ? withIncludedLead(draft, leadId) : withoutChosenLead(draft, leadId)));
  const remove = (leadId: string) => audience.update((draft) => withoutChosenLead(draft, leadId));
  return { ids, chosen, toggle, remove };
}

function PickedLeads({ audience, readOnly }: { audience: CampaignAudience; readOnly: boolean }) {
  const t = useTranslations("campaignAudience.step.hand");
  const { ids, chosen, toggle, remove } = useChoices(audience);
  return (
    <PanelSection boxed title={t("picked", { count: ids.length })}>
      <div className={cn("grid gap-5", !readOnly && "lg:grid-cols-2")}>
        {readOnly ? null : <LeadSearch audience={audience} chosen={chosen} onToggle={toggle} />}
        {ids.length > 0 ? <ChosenLeads audience={audience} ids={ids} readOnly={readOnly} onRemove={remove} /> : <p className="text-sm text-muted-foreground">{t("pickedEmpty")}</p>}
      </div>
    </PanelSection>
  );
}

function IncludedLeads({ audience, readOnly }: { audience: CampaignAudience; readOnly: boolean }) {
  const t = useTranslations("campaignAudience.step.hand");
  const { ids, chosen, toggle, remove } = useChoices(audience);
  const [searching, setSearching] = useState(false);
  const panelId = useId();
  if (ids.length === 0 && (readOnly || !searching)) {
    if (readOnly) return null;
    return (
      <Button type="button" variant="ghost" size="sm" title={t("add")} icon={<UserPlus className="h-4 w-4" />} iconVisible aria-expanded={false} onClick={() => setSearching(true)} />
    );
  }
  return (
    <section aria-label={t("included", { count: ids.length })} className="space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-medium text-foreground">{t("included", { count: ids.length })}</span>
          <span className="text-muted-foreground"> · {t("includedHint")}</span>
        </p>
        {readOnly ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title={searching ? t("closeSearch") : t("add")}
            icon={searching ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            iconVisible
            aria-expanded={searching}
            aria-controls={panelId}
            onClick={() => setSearching((open) => !open)}
          />
        )}
      </div>
      <div id={panelId} className={cn("grid gap-5", searching && "lg:grid-cols-2")}>
        {searching && !readOnly ? <LeadSearch audience={audience} chosen={chosen} onToggle={toggle} /> : null}
        {ids.length > 0 ? <ChosenLeads audience={audience} ids={ids} readOnly={readOnly} onRemove={remove} /> : null}
      </div>
    </section>
  );
}

export function LeadsHandPicker({ audience, readOnly = false }: { audience: CampaignAudience; readOnly?: boolean }) {
  return audience.draft.pick === "ids" ? <PickedLeads audience={audience} readOnly={readOnly} /> : <IncludedLeads audience={audience} readOnly={readOnly} />;
}

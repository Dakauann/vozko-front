"use client";

import { useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ArrowRight, PushPin, UserMinus } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Notice } from "@/components/ui/notice";
import { withExcludedLeads, withIncludedLead, withoutChosenLead } from "@/lib/campaign-audience/draft";
import type { AudienceLead } from "@/lib/campaign-audience/types";
import { cn } from "@/lib/utils";

import { LEAD_STATUS_TONE, type AudienceLeadFocus } from "./AudienceLeadsSheet";
import { useOutReasonText } from "./use-audience-copy";
import { useAudienceLeadsQuery } from "./use-audience-queries";
import type { CampaignAudience } from "./use-campaign-audience";

const PREVIEW_SIZE = 5;
const PREVIEW_QUERY = { search: "", page: 1, limit: PREVIEW_SIZE };
const ROW = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)]";
const ADJUSTABLE_ROW = "sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]";
const ROW_ACTION =
  "flex h-8 w-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-muted aria-pressed:text-foreground";

interface RowAdjust {
  included: boolean;
  onInclude: (on: boolean) => void;
  onExclude: () => void;
}

function PreviewRow({ lead, reasonText, adjust }: { lead: AudienceLead; reasonText: (reason: string) => string; adjust?: RowAdjust }) {
  const t = useTranslations("campaignAudience.step");
  const name = lead.name || t("hand.unnamed");
  return (
    <li className={cn(ROW, adjust && ADJUSTABLE_ROW)}>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium text-foreground">{lead.name || (lead.line > 0 ? t("leads.line", { line: lead.line }) : <EmptyValue />)}</span>
        {adjust?.included ? <span className="shrink-0 text-xs text-muted-foreground">{t("preview.includedTag")}</span> : null}
      </span>
      <span className="col-start-1 row-start-2 truncate font-mono text-xs tabular-nums text-muted-foreground sm:col-start-auto sm:row-start-auto sm:text-sm">
        {lead.contact || <EmptyValue />}
      </span>
      <span className="col-start-2 row-span-2 row-start-1 flex min-w-0 flex-col items-end gap-0.5 sm:col-start-auto sm:row-span-1 sm:row-start-auto sm:flex-row sm:items-center sm:gap-2">
        <StatusChip tone={LEAD_STATUS_TONE[lead.status]} label={t(`leads.status.${lead.status}`)} className="shrink-0" />
        {lead.reason ? <span className="truncate text-xs text-muted-foreground">{reasonText(lead.reason)}</span> : null}
      </span>
      {adjust ? (
        <span className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
          <button
            type="button"
            aria-pressed={adjust.included}
            aria-label={t("preview.include", { name })}
            title={t("preview.include", { name })}
            onClick={() => adjust.onInclude(!adjust.included)}
            className={ROW_ACTION}
          >
            <PushPin className="h-4 w-4" weight={adjust.included ? "fill" : "regular"} />
          </button>
          <button type="button" aria-label={t("preview.exclude", { name })} title={t("preview.exclude", { name })} onClick={adjust.onExclude} className={ROW_ACTION}>
            <UserMinus className="h-4 w-4" />
          </button>
        </span>
      ) : null}
    </li>
  );
}

export function AudienceLeadsPreview({ audience, onOpen, readOnly = false }: { audience: CampaignAudience; onOpen: (focus: AudienceLeadFocus) => void; readOnly?: boolean }) {
  const t = useTranslations("campaignAudience.step.preview");
  const reasonText = useOutReasonText(audience.channel);
  const leads = useAudienceLeadsQuery(audience.channel, audience.countedSpec, audience.countedFields, PREVIEW_QUERY);
  const page = leads.data;
  const items = page?.items ?? [];
  const total = page?.totalItems ?? 0;
  const description = page && total > 0 ? (total > items.length ? t("descriptionMore", { shown: items.length, count: total }) : t("description", { count: total })) : undefined;
  const adjustable = !readOnly && audience.draft.source === "leads" && audience.draft.pick !== "ids";
  const included = new Set(audience.draft.includeIds ?? []);
  const adjustOf = (lead: AudienceLead): RowAdjust | undefined =>
    adjustable && lead.leadId
      ? {
          included: included.has(lead.leadId),
          onInclude: (on) => audience.update((draft) => (on ? withIncludedLead(draft, lead.leadId) : withoutChosenLead(draft, lead.leadId))),
          onExclude: () => audience.update((draft) => withExcludedLeads(draft, [lead.leadId])),
        }
      : undefined;

  return (
    <PanelSection
      boxed
      title={t("title")}
      description={description}
      actions={total > 0 ? <Button type="button" variant="secondary" size="sm" title={t("viewAll")} icon={<ArrowRight className="h-3.5 w-3.5" />} iconVisible iconSide="right" onClick={() => onOpen({})} /> : null}
    >
      {leads.isError ? (
        <Notice tone="fault" title={t("failed")}>
          <Button type="button" variant="secondary" size="sm" title={t("retry")} onClick={() => void leads.refetch()} />
        </Notice>
      ) : !page ? (
        <ul aria-busy className="divide-y divide-border">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index} className={ROW}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="hidden h-4 w-28 sm:block" />
              <Skeleton className="h-5 w-20 justify-self-end sm:justify-self-start" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul aria-busy={leads.isFetching} className={cn("divide-y divide-border transition-opacity duration-200", leads.isPlaceholderData && "opacity-60")}>
          {items.map((lead, index) => (
            <PreviewRow key={lead.leadId || `${lead.line}-${index}`} lead={lead} reasonText={reasonText} adjust={adjustOf(lead)} />
          ))}
        </ul>
      )}
    </PanelSection>
  );
}

"use client";

import { useFormatter, useTranslations } from "next-intl";

import { Handshake, Lock } from "@/components/icons";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { OwnerChip } from "@/components/leads/OwnerChip";
import { NO_DEAL_MEMBERS, useDealActorLabels } from "@/hooks/use-deal-actor-labels";
import { isForbiddenSection, useLeadDeals } from "@/hooks/use-lead-records";
import { dealActorName, type Opportunity, type OpportunityStatus } from "@/lib/crm/opportunities";
import { dealsOf } from "@/lib/leads/timeline";
import { cn } from "@/lib/utils";

import { NewLeadDealButton, useLeadDealDrawer } from "./LeadDealDrawer";
import { PagedListFooter, pagedSectionState } from "./PagedListFooter";
import { useInstantText } from "./use-instant-text";

const STATUS_TONE: Record<OpportunityStatus, StatusChipTone> = {
  open: "outline",
  won: "healthy",
  lost: "muted",
};

function statusOf(status: string): OpportunityStatus {
  return status in STATUS_TONE ? (status as OpportunityStatus) : "open";
}

function DealRow({ deal, onOpen }: { deal: Opportunity; onOpen?: () => void }) {
  const t = useTranslations("leadDetail.deals");
  const format = useFormatter();
  const instantText = useInstantText();
  const actors = useDealActorLabels();
  const owner = dealActorName(deal.ownerId, NO_DEAL_MEMBERS, actors, deal.ownerName);
  const status = statusOf(deal.status);
  const created = instantText(deal.createdAt);
  const value = deal.valueCents > 0 ? format.number(deal.valueCents / 100, { style: "currency", currency: deal.currency || "BRL" }) : null;
  const titleClass = cn("block truncate text-sm font-medium", deal.title ? "text-foreground" : "text-muted-foreground");
  const title = deal.title || t("untitled");

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-1 border-b border-border py-2.5 last:border-0">
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0">
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              className={cn(
                titleClass,
                "max-w-full text-left underline-offset-2 hover:underline focus-visible:rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {title}
            </button>
          ) : (
            <span className={titleClass}>{title}</span>
          )}
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {owner ? <OwnerChip name={owner}>{t("owner", { name: owner })}</OwnerChip> : <span>{t("noOwner")}</span>}
            {created ? <span>{t("createdAt", { date: created })}</span> : null}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <span className="readout text-sm tabular-nums text-foreground">{value ?? <EmptyValue />}</span>
        <StatusChip tone={STATUS_TONE[status]} label={t(`status.${status}`)} />
      </span>
    </li>
  );
}

export function LeadDealsTab({ leadId, leadName, canCreate, canEdit }: { leadId: string; leadName: string; canCreate: boolean; canEdit: boolean }) {
  const t = useTranslations("leadDetail.deals");
  const query = useLeadDeals(leadId, true);
  const drawer = useLeadDealDrawer({ leadId, leadName });
  const pages = query.data?.pages;
  const deals = dealsOf(pages);
  const forbidden = query.isError && isForbiddenSection(query.error);
  const empty = query.isSuccess && deals.length === 0 && !query.hasNextPage;

  const addButton = canCreate && !forbidden ? <NewLeadDealButton loading={drawer.loading} onClick={drawer.create} /> : null;

  return (
    <PanelSection title={t("title")} description={t("description")} actions={empty ? undefined : addButton ?? undefined}>
      {forbidden ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" aria-hidden />
          {t("forbidden")}
        </p>
      ) : (
        <SectionState query={pagedSectionState(query)}>
          {query.isPending ? (
            <ScreenLoader fit="inline" />
          ) : empty ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Handshake className="h-4 w-4" aria-hidden />
                {t("empty")}
              </p>
              {addButton}
            </div>
          ) : (
            <>
              {deals.length > 0 ? (
                <ul aria-label={t("title")}>
                  {deals.map((deal) => (
                    <DealRow key={deal.id} deal={deal} onOpen={canEdit ? () => drawer.edit(deal) : undefined} />
                  ))}
                </ul>
              ) : null}
              <PagedListFooter
                query={query}
                pageSizes={pages?.map((page) => page.deals.length) ?? []}
                loadMore={t("loadMore")}
                loadingMore={t("loadingMore")}
              />
            </>
          )}
        </SectionState>
      )}
      {drawer.element}
    </PanelSection>
  );
}

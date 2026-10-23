"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { listCampaignRecipientsAction } from "@/app/actions/carrier-messaging";
import { RECIPIENTS_PAGE_LIMIT } from "@/lib/carrier-messaging/analytics";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { PanelSection } from "@/components/dashboard/PanelSection";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import { Users } from "@/components/icons";
import type { CampaignRecipient } from "@/lib/carrier-messaging/analytics";
import { RECIPIENT_STATUSES, type Campaign, type RecipientStatus } from "@/lib/carrier-messaging/campaigns";

import { CARRIER_QUERY_OPTIONS, LIVE_REFRESH_MS, answerOrThrow, useCarrierWorkspaceId } from "../overview/carrier-query";
import { variantLabel } from "./detail-format";


type StatusFilter = RecipientStatus | "all";

const STATUS_TONE: Record<RecipientStatus, StatusChipTone> = {
  pending: "muted",
  sent: "healthy",
  skipped: "outline",
  failed: "fault",
};

export function RecipientsPanel({ campaign, live }: { campaign: Campaign; live: boolean }) {
  const t = useTranslations("carrierMessaging.pages.campaignDetail.recipients");
  const tStatus = useTranslations("carrierMessaging.recipientStatus");
  const tSkip = useTranslations("carrierMessaging.skipReasons");
  const format = useFormatter();
  const empty = useEmptyValue();
  const workspaceId = useCarrierWorkspaceId();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const filter = status === "all" ? undefined : status;
  const query = useQuery({
    ...CARRIER_QUERY_OPTIONS,
    queryKey: ["carrier-campaign", workspaceId, campaign.id, "recipients", status, page],
    queryFn: async ({ signal }) => answerOrThrow(await listCampaignRecipientsAction(campaign.id, { page, status: filter }, signal)),
    enabled: workspaceId !== "",
    refetchInterval: live ? LIVE_REFRESH_MS : false,
    placeholderData: keepPreviousData,
  });
  const total = query.data?.total ?? 0;
  const abTest = campaign.variants.length > 1;

  const detail = (row: CampaignRecipient) => {
    if (row.skip_reason) return tSkip.has(row.skip_reason) ? tSkip(row.skip_reason) : row.skip_reason;
    if (row.message_status) return t.has(`messageStatus.${row.message_status}`) ? t(`messageStatus.${row.message_status}`) : row.message_status;
    return empty;
  };

  const columns: DashboardTableColumn<CampaignRecipient>[] = [
    {
      header: t("contact"),
      key: "contact",
      render: (row) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-foreground">{row.lead_name || row.phone}</span>
          {row.lead_name ? <span className="block truncate text-xs tabular-nums text-muted-foreground">{row.phone}</span> : null}
        </span>
      ),
    },
    ...(abTest
      ? [{ header: t("variant"), key: "variant", render: (row: CampaignRecipient) => variantLabel(campaign, row.variant, (letter) => t("fallbackVariant", { letter })) }]
      : []),
    { header: t("status"), key: "status", render: (row) => <StatusChip tone={STATUS_TONE[row.status]} label={tStatus(row.status)} /> },
    { header: t("detail"), key: "detail", render: (row) => <span className="text-sm text-muted-foreground">{detail(row)}</span> },
    {
      header: t("updatedAt"),
      key: "updatedAt",
      className: "text-right",
      render: (row) => <span className="tabular-nums text-muted-foreground">{format.dateTime(new Date(row.updated_at), { dateStyle: "short", timeStyle: "short" })}</span>,
    },
  ];

  return (
    <PanelSection title={t("title")} description={t("description")}>
      <SectionState query={query}>
        <DashboardTable<CampaignRecipient>
          data={query.data?.items ?? []}
          columns={columns}
          rowKey={(row, index) => `${row.phone}-${row.variant}-${index}`}
          loading={query.isFetching && !query.data}
          headerLeft={
            <ElevatedPillToggle<StatusFilter>
              size="sm"
              aria-label={t("filter")}
              value={status}
              onChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
              options={[{ value: "all", label: t("all") }, ...RECIPIENT_STATUSES.map((value) => ({ value, label: tStatus(value) }))]}
            />
          }
          emptyState={{ icon: <Users className="h-6 w-6" />, title: t("emptyTitle"), description: t("emptyDescription") }}
          pagination={{
            currentPage: page,
            totalPages: Math.max(1, Math.ceil(total / RECIPIENTS_PAGE_LIMIT.default)),
            pageSize: RECIPIENTS_PAGE_LIMIT.default,
            totalItems: total,
            onPageChange: setPage,
          }}
        />
      </SectionState>
    </PanelSection>
  );
}

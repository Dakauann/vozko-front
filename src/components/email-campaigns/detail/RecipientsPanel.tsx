"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { PanelSection } from "@/components/dashboard/PanelSection";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { MagnifyingGlass, Users } from "@/components/icons";
import { useEmailCampaignRecipients } from "@/hooks/use-email-campaigns";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import { RECIPIENTS_PAGE_SIZE, recipientState } from "@/lib/email-campaigns/recipients";
import { RECIPIENT_STATUSES, SKIP_REASONS, VARIANTS, type Recipient, type RecipientStatus, type SkipReason, type Variant } from "@/lib/email-campaigns/types";

import { useEmailErrorMessage, useEmailFormat } from "../shared";

const ANY = "any";
const SEARCH_DEBOUNCE_MS = 300;

export function RecipientsPanel({
  campaignId,
  abTest,
  interval,
  status: chosen,
  onStatusChange,
}: {
  campaignId: string;
  abTest: boolean;
  interval: number | false;
  status: RecipientStatus | "";
  onStatusChange: (status: RecipientStatus | "") => void;
}) {
  const t = useTranslations("emailCampaigns.detail.recipients");
  const tSkip = useTranslations("emailCampaigns.skip");
  const tVariant = useTranslations("emailCampaigns.detail.ab.variant");
  const errorMessage = useEmailErrorMessage();
  const { dateTime } = useEmailFormat();
  const status: RecipientStatus | typeof ANY = chosen === "" ? ANY : chosen;
  const [chosenReason, setSkipReason] = useState<SkipReason | typeof ANY>(ANY);
  const skipReason = status === "skipped" ? chosenReason : ANY;
  const [variant, setVariant] = useState<Variant | typeof ANY>(ANY);
  const [search, setSearch] = useState("");
  const [settled, setSettled] = useState("");
  const [paging, setPaging] = useState({ status, page: 1 });
  const page = paging.status === status ? paging.page : 1;
  const setPage = (next: number) => setPaging({ status, page: next });

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useEmailCampaignRecipients(
    campaignId,
    {
      status: status === ANY ? undefined : status,
      skipReason: skipReason === ANY ? undefined : skipReason,
      variant: variant === ANY ? undefined : variant,
      search: settled,
      page,
      pageSize: RECIPIENTS_PAGE_SIZE,
    },
    interval,
  );
  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / RECIPIENTS_PAGE_SIZE));
  const reset = () => setPage(1);
  const when = (iso: string | undefined) => (iso ? <span className="whitespace-nowrap text-xs text-foreground">{dateTime(iso)}</span> : <EmptyValue className="text-xs" />);

  const columns: DashboardTableColumn<Recipient>[] = [
    {
      key: "address",
      header: t("columns.address"),
      className: "min-w-[220px]",
      render: (row) =>
        row.lead_name ? (
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{row.lead_name}</span>
            <span className="block truncate text-2xs text-muted-foreground">{row.address}</span>
          </div>
        ) : (
          <span className="block truncate text-sm text-foreground">{row.address}</span>
        ),
    },
    ...(abTest
      ? [{ key: "variant", header: t("columns.variant"), render: (row: Recipient) => (row.variant ? <span className="text-xs text-muted-foreground">{tVariant(row.variant)}</span> : <EmptyValue className="text-xs" />) }]
      : []),
    {
      key: "state",
      header: t("columns.state"),
      render: (row) => {
        const state = recipientState(row);
        const detail = row.skip_reason ? tSkip(row.skip_reason) : row.bounce_kind ? t(`bounce.${row.bounce_kind === "hard" ? "hard" : "soft"}`) : row.failure_code ? t("failureCode", { code: row.failure_code }) : null;
        return (
          <div className="flex flex-col items-start gap-0.5">
            <StatusChip tone={state.tone} label={t(`states.${state.key}`)} />
            {detail ? <span className="text-2xs text-muted-foreground">{detail}</span> : null}
          </div>
        );
      },
    },
    { key: "sent", header: t("columns.sent"), render: (row) => when(row.sent_at) },
    { key: "opened", header: t("columns.opened"), render: (row) => when(row.opened_at) },
    { key: "clicked", header: t("columns.clicked"), render: (row) => when(row.clicked_at) },
  ];

  return (
    <PanelSection title={t("title")} description={t("description")}>
      <DashboardTable<Recipient>
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={query.isPending}
        headerLeft={
          <div className="w-full max-w-xs">
            <ElevatedInput
              type="search"
              label={t("search")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                reset();
              }}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
            />
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <ElevatedSelect
              value={status}
              aria-label={t("filters.status")}
              onValueChange={(value) => {
                if (value !== "skipped") setSkipReason(ANY);
                onStatusChange(value === ANY ? "" : (value as RecipientStatus));
              }}
              className="w-auto min-w-[140px]"
            >
              <ElevatedSelectItem value={ANY}>{t("filters.anyStatus")}</ElevatedSelectItem>
              {RECIPIENT_STATUSES.map((value) => (
                <ElevatedSelectItem key={value} value={value}>
                  {t(`statuses.${value}`)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
            <ElevatedSelect
              value={skipReason}
              aria-label={t("filters.skipReason")}
              onValueChange={(value) => {
                setSkipReason(value as SkipReason | typeof ANY);
                if (value !== ANY && chosen !== "skipped") onStatusChange("skipped");
                reset();
              }}
              className="w-auto min-w-[160px]"
            >
              <ElevatedSelectItem value={ANY}>{t("filters.anyReason")}</ElevatedSelectItem>
              {SKIP_REASONS.map((value) => (
                <ElevatedSelectItem key={value} value={value}>
                  {tSkip(value)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
            {abTest ? (
              <ElevatedSelect
                value={variant}
                aria-label={t("filters.variant")}
                onValueChange={(value) => {
                  setVariant(value as Variant | typeof ANY);
                  reset();
                }}
                className="w-auto min-w-[130px]"
              >
                <ElevatedSelectItem value={ANY}>{t("filters.anyVariant")}</ElevatedSelectItem>
                {VARIANTS.map((value) => (
                  <ElevatedSelectItem key={value} value={value}>
                    {tVariant(value)}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            ) : null}
          </div>
        }
        stats={[{ label: t("total"), value: query.isPending ? "…" : total }]}
        pagination={totalPages > 1 ? { currentPage: page, totalPages, pageSize: RECIPIENTS_PAGE_SIZE, totalItems: total, onPageChange: setPage } : undefined}
        emptyState={
          query.isError
            ? { icon: <Users className="h-7 w-7 text-destructive-ink" />, title: t("error"), description: errorMessage({ code: sectionErrorCode(query.error) }) }
            : { icon: <Users className="h-7 w-7 text-muted-foreground" />, title: t("empty"), description: t("emptyHint") }
        }
      />
    </PanelSection>
  );
}

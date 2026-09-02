"use client";

import { Archive } from "@/components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CampaignsListShell } from "@/components/campaigns/CampaignsListShell";
import { ChannelTile } from "@/components/channels/channel-tile";
import { CampaignsSummaryBar } from "@/components/dashboard/CampaignsSummaryBar";
import { DepartmentRowSwitcher } from "@/components/dashboard/DepartmentRowSwitcher";
import type { CampaignMetrics } from "@/lib/campaigns/metrics";
import type { UnofficialWhatsAppCampaign } from "@/lib/unofficial-whatsapp-campaigns/types";
import { campaignColumns } from "./_components/campaign-columns";
import {
  archiveUnofficialCampaignAction,
  assignUnofficialCampaignDepartmentAction,
  getUnofficialCampaignsSummaryAction,
  listUnofficialCampaignsAction,
} from "@/app/actions/unofficial-whatsapp-campaigns";
import { useDepartment } from "@/contexts/department-context";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const PAGE_SIZE = 15;

export default function UnofficialWhatsAppCampaignsPage() {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const { can, currentWorkspace } = useWorkspace();
  const { currentDepartment } = useDepartment();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<UnofficialWhatsAppCampaign[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalPages: 1, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [summaryFrom, setSummaryFrom] = useState("");
  const [summaryTo, setSummaryTo] = useState("");
  const [summary, setSummary] = useState<CampaignMetrics | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setSummaryLoading(true);
    try {
      const result = await getUnofficialCampaignsSummaryAction({
        from: summaryFrom || undefined,
        to: summaryTo || undefined,
      });
      setSummary(result.metrics ?? null);
    } finally {
      setSummaryLoading(false);
    }
  }, [currentWorkspace?.id, summaryFrom, summaryTo]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, currentDepartment]);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Search and status are sent to the SERVER rather than filtered in the
      // browser: filtering a single page client-side silently hides matches on
      // every other page, which reads as "the campaign is gone".
      const result = await listUnofficialCampaignsAction({
        page,
        pageSize: PAGE_SIZE,
        search: search.trim() || undefined,
        status: statusFilter,
      });
      if (result.error) {
        setError(result.error);
        setCampaigns([]);
        return;
      }
      setCampaigns(result.campaigns);
      setMeta(result.meta);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    // Debounced so typing in the search box does not fire a request per keypress.
    const timer = setTimeout(fetchCampaigns, 250);
    return () => clearTimeout(timer);
  }, [currentWorkspace?.id, currentDepartment, fetchCampaigns]);

  // Any filter change returns to page 1: staying on page 4 of a narrower result
  // set shows an empty table that looks like "no campaigns".
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const columns = useMemo(() => campaignColumns(t as (k: string) => string), [t]);

  const contactCount = campaigns.reduce(
    (sum, c) => sum + (c.metrics?.totalNumbers ?? 0),
    0,
  );

  const handleArchive = async (campaignId: string) => {
    const result = await archiveUnofficialCampaignAction(campaignId);
    if (!result.error) {
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    }
  };

  return (
    <CampaignsListShell<UnofficialWhatsAppCampaign>
      labels={{
        badge: t("page.badge"),
        description: t("page.description"),
        newButton: t("page.newButton"),
        searchPlaceholder: t("page.searchPlaceholder"),
        filterAll: t("filter.all"),
        statusLabels: {
          RUNNING: t("status.running"),
          PAUSED: t("status.paused"),
          STOPPED: t("status.stopped"),
          COMPLETED: t("status.completed"),
        },
        stats: {
          total: t("stats.total"),
          active: t("stats.active"),
          contacts: t("stats.contacts"),
          paused: t("stats.paused"),
        },
        emptyTitle: t("empty.title"),
        emptyDescription: t("empty.description"),
        errorTitle: t("error.title"),
      }}
      icon={<ChannelTile channel="unofficial_whatsapp" size="md" />}
      rows={campaigns}
      columns={columns}
      loading={loading}
      error={error}
      totalItems={meta.totalItems}
      totalPages={meta.totalPages}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      search={search}
      onSearchChange={setSearch}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      contactCount={contactCount}
      onRowClick={(row) =>
        router.push(`/dashboard/unofficial-whatsapp-campaigns/${row.id}`)
      }
      canCreate={can("unofficial_whatsapp_campaigns", "create")}
      createHref="/dashboard/unofficial-whatsapp-campaigns/new"
      summary={
        <CampaignsSummaryBar
          variant="whatsapp"
          metrics={summary}
          loading={summaryLoading}
          from={summaryFrom}
          to={summaryTo}
          onFromChange={setSummaryFrom}
          onToChange={setSummaryTo}
          onClear={() => {
            setSummaryFrom("");
            setSummaryTo("");
          }}
        />
      }
      renderRowActions={(row) => (
        <>
          <DepartmentRowSwitcher
            departmentId={row.departmentId}
            onAssign={() =>
              assignUnofficialCampaignDepartmentAction(row.id).then((result) => ({
                item: result.campaign,
                error: result.error,
              }))
            }
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleArchive(row.id);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <Archive className="h-3.5 w-3.5" weight="bold" />
            {t("actions.archive")}
          </button>
        </>
      )}
    />
  );
}

"use client";

import { ArrowCounterClockwise } from "@/components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CampaignsListShell } from "@/components/campaigns/CampaignsListShell";
import { ChannelTile } from "@/components/channels/channel-tile";
import type { UnofficialWhatsAppCampaign } from "@/lib/unofficial-whatsapp-campaigns/types";
import { campaignColumns } from "../_components/campaign-columns";
import {
  listUnofficialCampaignsAction,
  unarchiveUnofficialCampaignAction,
} from "@/app/actions/unofficial-whatsapp-campaigns";
import { useDepartment } from "@/contexts/department-context";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const PAGE_SIZE = 15;

export default function ArchivedUnofficialCampaignsPage() {
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

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listUnofficialCampaignsAction({
        page,
        pageSize: PAGE_SIZE,
        search: search.trim() || undefined,
        status: statusFilter,
        archived: true,
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
    const timer = setTimeout(fetchCampaigns, 250);
    return () => clearTimeout(timer);
  }, [currentWorkspace?.id, currentDepartment, fetchCampaigns]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const columns = useMemo(() => campaignColumns(t as (k: string) => string), [t]);

  return (
    <CampaignsListShell<UnofficialWhatsAppCampaign>
      labels={{
        badge: t("archived.badge"),
        description: t("archived.description"),
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
        emptyTitle: t("archived.emptyTitle"),
        emptyDescription: t("archived.emptyDescription"),
        errorTitle: t("error.title"),
      }}
      icon={<ChannelTile channel="unofficial_whatsapp" size="md" />}
      headerColorClass="text-muted-foreground"
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
      contactCount={campaigns.reduce((sum, c) => sum + (c.metrics?.totalNumbers ?? 0), 0)}
      onRowClick={(row) =>
        router.push(`/dashboard/unofficial-whatsapp-campaigns/${row.id}`)
      }
      // Archived campaigns are not created from here; the button would lead
      // somewhere that immediately leaves this screen.
      canCreate={false}
      createHref="/dashboard/unofficial-whatsapp-campaigns/new"
      renderRowActions={(row) =>
        can("unofficial_whatsapp_campaigns", "update") ? (
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              const result = await unarchiveUnofficialCampaignAction(row.id);
              if (!result.error) {
                setCampaigns((prev) => prev.filter((c) => c.id !== row.id));
              }
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowCounterClockwise className="h-3.5 w-3.5" weight="bold" />
            {t("actions.unarchive")}
          </button>
        ) : null
      }
    />
  );
}

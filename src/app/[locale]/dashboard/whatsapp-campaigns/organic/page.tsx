"use client";

import { Archive, Leaf, MagnifyingGlass, Plus } from "@/components/icons";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import type {
  WhatsAppCampaign,
  WhatsAppCampaignListMeta,
} from "@/lib/whatsapp-campaigns/types";
import {
  archiveWhatsAppCampaignAction,
  listWhatsAppCampaignsAction,
} from "@/app/actions/whatsapp-campaigns";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";
import { useDepartment } from "@/contexts/department-context";

const ITEMS_PER_PAGE = 15;

const statusColor: Record<string, string> = {
  RUNNING: "bg-healthy text-healthy-foreground",
  PAUSED: "bg-warning text-warning-foreground",
  STOPPED: "bg-muted text-muted-foreground",
  COMPLETED: "bg-muted text-muted-foreground",
};

export default function OrganicCampaignsPage() {
  const t = useTranslations("whatsappCampaignsPage");
  const { can, currentWorkspace } = useWorkspace();
  const { currentDepartment } = useDepartment();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [meta, setMeta] = useState<WhatsAppCampaignListMeta>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchCampaigns = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listWhatsAppCampaignsAction(
          pageNum,
          ITEMS_PER_PAGE,
          "desc",
          currentWorkspace?.id,
          "organic",
        );
        if (result.error) {
          setError(result.error);
        } else {
          setCampaigns(result.campaigns);
          setMeta(result.meta);
        }
      } catch {
        setError("Failed to load campaigns");
      } finally {
        setLoading(false);
      }
    },
    [currentWorkspace?.id, currentDepartment?.id],
  );

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    fetchCampaigns(page);
  }, [currentWorkspace?.id, fetchCampaigns, page]);

  const handleArchive = async (campaignId: string) => {
    const result = await archiveWhatsAppCampaignAction(campaignId);
    if (!result.error) {
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCampaigns = campaigns.filter(
    (c) => c.status === "RUNNING",
  ).length;
  const totalContacts = campaigns.reduce(
    (sum, c) => sum + (c.metrics?.totalNumbers || 0),
    0,
  );

  const columns = useMemo<DashboardTableColumn<WhatsAppCampaign>[]>(
    () => [
      {
        key: "name",
        header: t("organicListing.badge"),
        render: (row) => (
          <span className="text-sm font-medium text-foreground">
            {row.name}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
              statusColor[row.status] ?? "bg-[hsl(var(--plate-neutral))] text-white",
            )}
          >
            {t(`status.${row.status.toLowerCase()}` as Parameters<typeof t>[0])}
          </span>
        ),
      },
      {
        key: "total",
        header: t("card.total"),
        render: (row) => (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {row.metrics?.totalNumbers ?? 0}
          </span>
        ),
      },
      {
        key: "sent",
        header: t("status.sent"),
        render: (row) => (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {row.metrics?.sent ?? 0}
          </span>
        ),
      },
      {
        key: "delivered",
        header: t("status.delivered"),
        render: (row) => (
          <span className="text-sm font-semibold tabular-nums text-healthy-ink">
            {row.metrics?.delivered ?? 0}
          </span>
        ),
      },
      {
        key: "read",
        header: t("status.read"),
        render: (row) => (
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {row.metrics?.read ?? 0}
          </span>
        ),
      },
      {
        key: "failed",
        header: t("status.failed"),
        render: (row) => (
          <span className="text-sm font-semibold tabular-nums text-destructive-ink">
            {row.metrics?.failed ?? 0}
          </span>
        ),
      },
      {
        key: "successRate",
        header: t("card.successRateLabel"),
        render: (row) => (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {row.metrics?.successRate != null
              ? `${row.metrics.successRate.toFixed(1)}%`
              : "—"}
          </span>
        ),
      },
      {
        key: "createdAt",
        header: t("card.createdAt"),
        render: (row) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {new Date(row.createdAt).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader
        icon={<Leaf className="h-6 w-6" weight="fill" />}
        badge={t("organicListing.badge")}
        description={t("organicListing.description")}
        colorClass="text-muted-foreground"
        actions={
          can("whatsapp_campaigns", "create") ? (
            <Button
              variant="primary"
              title={t("newOrganicButton")}
              icon={<Plus className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              link="/dashboard/whatsapp-campaigns/new-organic"
              newTab={false}
            />
          ) : undefined
        }
      />

      <DashboardTable<WhatsAppCampaign>
        data={filteredCampaigns}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) =>
          router.push(`/dashboard/whatsapp-campaigns/${row.id}`)
        }
        stats={[
          {
            label: t("stats.total"),
            value: loading ? "..." : meta.total,
          },
          {
            label: t("stats.active"),
            value: loading ? "..." : activeCampaigns,
          },
          {
            label: t("organicListing.conversations"),
            value: loading ? "..." : totalContacts.toLocaleString(),
          },
          {
            label: t("stats.paused"),
            value: loading
              ? "..."
              : campaigns.filter((c) => c.status === "PAUSED").length,
          },
        ]}
        headerLeft={
          <div className="relative w-full max-w-xs">
            <ElevatedInput
              type="text"
              label={t("search.placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full"
            />
          </div>
        }
        toolbar={
          <ElevatedSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
            className="w-auto min-w-[140px]"
          >
            <ElevatedSelectItem value="all">
              {t("filter.all")}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="RUNNING">
              {t("status.running")}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="PAUSED">
              {t("status.paused")}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="STOPPED">
              {t("status.stopped")}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="COMPLETED">
              {t("status.completed")}
            </ElevatedSelectItem>
          </ElevatedSelect>
        }
        renderRowActions={(row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleArchive(row.id);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <Archive className="h-3.5 w-3.5" weight="bold" />
            {t("card.archive")}
          </button>
        )}
        pagination={
          meta.totalPages > 1
            ? {
                currentPage: page,
                totalPages: meta.totalPages,
                pageSize: ITEMS_PER_PAGE,
                totalItems: meta.total,
                onPageChange: setPage,
              }
            : undefined
        }
        emptyState={
          error
            ? {
                icon: <Leaf className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("error.title"),
                description: error,
              }
            : {
                icon: (
                  <Leaf
                    className="h-7 w-7 text-muted-foreground"
                    weight="fill"
                  />
                ),
                title: t("empty.title"),
                description: t("empty.organicDescription"),
                action: can("whatsapp_campaigns", "create") ? (
                  <Button
                    variant="primary"
                    title={t("newOrganicButton")}
                    icon={<Plus className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    link="/dashboard/whatsapp-campaigns/new-organic"
                    newTab={false}
                  />
                ) : undefined,
              }
        }
      />
    </main>
  );
}

"use client";

import {
  Archive,
  MagnifyingGlass,
  Plus,
  WhatsappLogo,
} from "@phosphor-icons/react";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import type {
  WhatsAppCampaign,
  WhatsAppCampaignListMeta,
  WhatsAppCampaignMetrics,
} from "@/lib/whatsapp-campaigns/types";
import {
  archiveWhatsAppCampaignAction,
  assignWhatsAppCampaignDepartmentAction,
  getWhatsAppCampaignsSummaryAction,
  listWhatsAppCampaignsAction,
} from "@/app/actions/whatsapp-campaigns";
import { CampaignsSummaryBar } from "@/components/dashboard/CampaignsSummaryBar";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DepartmentRowSwitcher } from "@/components/dashboard/DepartmentRowSwitcher";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useDepartment } from "@/contexts/department-context";

const ITEMS_PER_PAGE = 15;

const statusColor: Record<string, string> = {
  RUNNING: "bg-emerald-500 text-white",
  PAUSED: "bg-amber-500 text-white",
  STOPPED: "bg-slate-500 text-white",
  COMPLETED: "bg-blue-500 text-white",
};

// Solid opaque tiles + white label — matches status chips and DESIGN.md
// (never bg-x/10 + text-x wash).
const CATEGORY_TONE: Record<string, string> = {
  MARKETING: "bg-violet-500 text-white",
  UTILITY: "bg-sky-500 text-white",
  AUTHENTICATION: "bg-amber-500 text-white",
};

export default function WhatsAppCampaignsPage() {
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

  const [summaryFrom, setSummaryFrom] = useState("");
  const [summaryTo, setSummaryTo] = useState("");
  const [summaryMetrics, setSummaryMetrics] =
    useState<WhatsAppCampaignMetrics | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setSummaryLoading(true);
    try {
      const result = await getWhatsAppCampaignsSummaryAction({
        workspaceId: currentWorkspace.id,
        type: "standard",
        from: summaryFrom || undefined,
        to: summaryTo || undefined,
      });
      setSummaryMetrics(result.metrics ?? null);
    } finally {
      setSummaryLoading(false);
    }
  }, [currentWorkspace?.id, summaryFrom, summaryTo]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, currentDepartment]);

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
          "standard",
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
    [currentWorkspace?.id],
  );

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    fetchCampaigns(page);
  }, [currentWorkspace?.id, currentDepartment, fetchCampaigns, page]);

  const handleArchive = async (campaignId: string) => {
    const result = await archiveWhatsAppCampaignAction(campaignId);
    if (!result.error) {
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    }
  };

  const handleAssignDepartment = async (
    campaignId: string,
    departmentId: string,
  ) => {
    const result = await assignWhatsAppCampaignDepartmentAction(
      campaignId,
      departmentId,
    );
    if (!result.error && result.campaign) {
      setCampaigns((prev) =>
        prev.map((campaign) =>
          campaign.id === campaignId ? (result.campaign ?? campaign) : campaign,
        ),
      );
    }
    return result;
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

  const categoryLabel = useCallback(
    (category?: string) => {
      const key = (category || "").toUpperCase();
      if (key === "MARKETING") return t("messageType.marketing");
      if (key === "UTILITY") return t("messageType.utility");
      if (key === "AUTHENTICATION") return t("messageType.authentication");
      return category || "—";
    },
    [t],
  );

  const columns = useMemo<DashboardTableColumn<WhatsAppCampaign>[]>(
    () => [
      {
        key: "name",
        header: t("header.badge"),
        render: (row) => (
          <div className="min-w-0">
            <span className="block text-sm font-medium text-foreground truncate">
              {row.name}
            </span>
            {row.templateName ? (
              <span className="block text-[11px] text-muted-foreground truncate">
                {row.templateName}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              statusColor[row.status] ?? "bg-gray-500 text-white",
            )}
          >
            {t(`status.${row.status.toLowerCase()}` as Parameters<typeof t>[0])}
          </span>
        ),
      },
      {
        key: "messageType",
        header: t("table.messageType"),
        render: (row) => {
          const cat = (row.templateCategory || "").toUpperCase();
          if (!cat) {
            return (
              <span className="text-sm text-muted-foreground">—</span>
            );
          }
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
                CATEGORY_TONE[cat] ?? "bg-muted text-muted-foreground",
              )}
            >
              {categoryLabel(cat)}
            </span>
          );
        },
      },
      {
        key: "total",
        header: t("card.total"),
        render: (row) => (
          <span className="text-sm font-bold tabular-nums text-foreground">
            {row.metrics?.totalNumbers ?? 0}
          </span>
        ),
      },
      {
        key: "dispatches",
        header: t("table.dispatches"),
        render: (row) => (
          <span className="text-sm font-bold tabular-nums text-foreground">
            {row.metrics?.dispatches ?? 0}
          </span>
        ),
      },
      {
        key: "delivered",
        header: t("status.delivered"),
        render: (row) => (
          <span className="text-sm font-bold tabular-nums text-emerald-600">
            {row.metrics?.delivered ?? 0}
          </span>
        ),
      },
      {
        key: "read",
        header: t("status.read"),
        render: (row) => (
          <span className="text-sm font-bold tabular-nums text-blue-600">
            {row.metrics?.read ?? 0}
          </span>
        ),
      },
      {
        key: "failed",
        header: t("status.failed"),
        render: (row) => (
          <span className="text-sm font-bold tabular-nums text-red-600">
            {row.metrics?.failed ?? 0}
          </span>
        ),
      },
      {
        key: "successRate",
        header: t("card.successRateLabel"),
        render: (row) => (
          <span className="text-sm font-bold tabular-nums text-foreground">
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
    [t, categoryLabel],
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      <DashboardPageHeader
        icon={<WhatsappLogo className="h-6 w-6" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
        colorClass="text-emerald-600"
        actions={
          can("whatsapp_campaigns", "create") ? (
            <Button
              variant="primary"
              title={t("newButton")}
              icon={<Plus className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              link="/dashboard/whatsapp-campaigns/new"
              newTab={false}
            />
          ) : undefined
        }
      />

      <CampaignsSummaryBar
        variant="whatsapp"
        metrics={summaryMetrics}
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
            label: t("stats.contacts"),
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
          <>
            <DepartmentRowSwitcher
              departmentId={row.departmentId}
              onAssign={(departmentId) =>
                handleAssignDepartment(row.id, departmentId).then((result) => ({
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
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Archive className="h-3.5 w-3.5" weight="bold" />
              {t("card.archive")}
            </button>
          </>
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
                icon: (
                  <WhatsappLogo
                    className="h-7 w-7 text-red-600"
                    weight="fill"
                  />
                ),
                title: t("error.title"),
                description: error,
              }
            : {
                icon: (
                  <WhatsappLogo
                    className="h-7 w-7 text-muted-foreground/40"
                    weight="fill"
                  />
                ),
                title: t("empty.title"),
                description: t("empty.standardDescription"),
                action: can("whatsapp_campaigns", "create") ? (
                  <Button
                    variant="primary"
                    title={t("newButton")}
                    icon={<Plus className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    link="/dashboard/whatsapp-campaigns/new"
                    newTab={false}
                  />
                ) : undefined,
              }
        }
      />
    </motion.main>
  );
}

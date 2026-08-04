"use client";

import {
  ArrowCounterClockwise,
  MagnifyingGlass,
  WhatsappLogo,
} from "@/components/icons";
import {
  listArchivedWhatsAppCampaignsAction,
  unarchiveWhatsAppCampaignAction,
} from "@/app/actions/whatsapp-campaigns";
import { useEffect, useMemo, useState } from "react";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const statusColor: Record<string, string> = {
  RUNNING: "bg-healthy text-healthy-foreground",
  PAUSED: "bg-warning text-warning-foreground",
  IDLE: "bg-muted text-muted-foreground",
  STOPPED: "bg-muted text-muted-foreground",
  COMPLETED: "bg-muted text-muted-foreground",
};

export default function ArchivedWhatsAppCampaignsPage() {
  const t = useTranslations("whatsappCampaignsPage");
  const tSidebar = useTranslations("sidebar");
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceLoading || !currentWorkspace?.id) return;

    async function fetchArchivedCampaigns() {
      setLoading(true);
      setError(null);
      try {
        const result = await listArchivedWhatsAppCampaignsAction(
          1,
          100,
          "desc",
          currentWorkspace?.id,
        );
        if (result.error) {
          setError(result.error);
        } else {
          setCampaigns(result.campaigns);
        }
      } catch {
        setError("Failed to load archived WhatsApp campaigns");
      } finally {
        setLoading(false);
      }
    }
    fetchArchivedCampaigns();
  }, [currentWorkspace?.id, workspaceLoading]);

  const handleUnarchive = async (campaignId: string) => {
    const result = await unarchiveWhatsAppCampaignAction(campaignId);
    if (!result.error) {
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const columns = useMemo<DashboardTableColumn<WhatsAppCampaign>[]>(
    () => [
      {
        key: "name",
        header: t("header.badge"),
        render: (row) => (
          <span className="text-sm font-medium text-foreground">
            {row.name}
          </span>
        ),
      },
      {
        key: "type",
        header: t("card.type"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.type ?? "standard"}
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
              statusColor[row.status] ?? "bg-gray-500 text-white",
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
          <span className="text-sm font-semibold tabular-nums text-healthy">
            {row.metrics?.delivered ?? 0}
          </span>
        ),
      },
      {
        key: "failed",
        header: t("status.failed"),
        render: (row) => (
          <span className="text-sm font-semibold tabular-nums text-destructive">
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
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      <DashboardPageHeader
        icon={<WhatsappLogo className="h-6 w-6" weight="fill" />}
        badge={tSidebar("nav.archivedWhatsappCampaigns")}
        description={t("archived.description")}
        colorClass="text-healthy"
      />

      <DashboardTable<WhatsAppCampaign>
        data={filteredCampaigns}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        stats={[
          {
            label: t("stats.total"),
            value: loading ? "..." : campaigns.length,
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
        renderRowActions={(row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleUnarchive(row.id);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowCounterClockwise className="h-3.5 w-3.5" weight="bold" />
            {t("archived.unarchive")}
          </button>
        )}
        emptyState={
          error
            ? {
                icon: (
                  <WhatsappLogo
                    className="h-7 w-7 text-destructive"
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
                title: t("archived.emptyTitle"),
                description: t("archived.emptyDescription"),
              }
        }
      />
    </motion.main>
  );
}

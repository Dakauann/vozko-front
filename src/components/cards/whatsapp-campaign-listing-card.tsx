"use client";

import {
  Archive,
  ArrowCounterClockwise,
  ChartLineUp,
  ChatsCircle,
  CheckCircle,
  Eye,
  PaperPlaneTilt,
  Robot,
  Siren,
  Tag,
  WhatsappLogo,
  XCircle,
} from "@/components/icons";
import type {
  WhatsAppCampaign,
  WhatsAppCampaignMetrics,
} from "@/lib/whatsapp-campaigns/types";

import { ListingCard } from "@/components/elevated-design/listing-card";

const statusConfig = {
  STOPPED: { labelKey: "status.stopped" },
  RUNNING: { labelKey: "status.running" },
  PAUSED: { labelKey: "status.paused" },
  COMPLETED: { labelKey: "status.completed" },
} as const;

const statusColorMap: Record<
  string,
  "emerald" | "amber" | "blue" | "slate" | "rose"
> = {
  RUNNING: "emerald",
  PAUSED: "amber",
  STOPPED: "slate",
  COMPLETED: "blue",
};

interface WhatsAppCampaignListingCardProps {
  campaign: WhatsAppCampaign;
  isArchived?: boolean;
  onArchive?: (campaignId: string) => void;
  onUnarchive?: (campaignId: string) => void;
  t: (key: string) => string;
}

export function WhatsAppCampaignListingCard({
  campaign,
  isArchived = false,
  onArchive,
  onUnarchive,
  t,
}: WhatsAppCampaignListingCardProps) {
  const status =
    statusConfig[(campaign.status || "STOPPED") as keyof typeof statusConfig] ||
    statusConfig.STOPPED;

  const metrics: WhatsAppCampaignMetrics = campaign.metrics || {
    totalNumbers: 0,
    pending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    notEligiblePossibleSpam: 0,
    dispatches: 0,
    completionRate: 0,
    successRate: 0,
  };

  const primaryAction = isArchived
    ? {
        label: t("card.unarchive"),
        icon: <ArrowCounterClockwise className="h-3.5 w-3.5" weight="bold" />,
        onClick: () => onUnarchive?.(campaign.id),
      }
    : {
        label: t("card.details"),
        icon: <Eye className="h-3.5 w-3.5" weight="fill" />,
        href: `/dashboard/whatsapp-campaigns/${campaign.id}`,
      };

  const menuItems = isArchived
    ? [
        {
          label: t("card.details"),
          icon: <Eye className="h-4 w-4" weight="bold" />,
          href: `/dashboard/whatsapp-campaigns/${campaign.id}`,
        },
      ]
    : [
        {
          label: t("card.archive"),
          icon: <Archive className="h-4 w-4" weight="bold" />,
          onClick: () => onArchive?.(campaign.id),
        },
      ];

       const categoryKey = (campaign.templateCategory || "").toUpperCase();
  const categoryLabel =
    categoryKey === "MARKETING"
      ? t("messageType.marketing")
      : categoryKey === "UTILITY"
        ? t("messageType.utility")
        : categoryKey === "AUTHENTICATION"
          ? t("messageType.authentication")
          : "";

  const metaItems = [
    ...(campaign.type !== "organic" && campaign.templateName
      ? [
          {
            icon: <WhatsappLogo weight="fill" />,
            label: t("card.template"),
            value: campaign.templateName,
            color: "text-healthy",
          },
        ]
      : []),
    ...(categoryLabel
      ? [
          {
            icon: <Tag weight="fill" />,
            label: t("table.messageType"),
            value: categoryLabel,
            color: "text-muted-foreground",
          },
        ]
      : []),
    ...(campaign.enableAgentResponses && campaign.agentName
      ? [
          {
            icon: <Robot weight="fill" />,
            label: t("card.agent"),
            value: campaign.agentName,
            color: "text-blue-500",
          },
        ]
      : []),
    ...(campaign.businessPhone
      ? [
          {
            icon: <PaperPlaneTilt weight="fill" />,
            label: t("card.phone"),
            value:
              campaign.businessPhone.verifiedName ||
              campaign.businessPhone.displayPhoneNumber,
            color: "text-muted-foreground",
          },
        ]
      : []),
  ];

  const organicStats = [
    {
      label: t("card.total"),
      value: metrics.totalNumbers.toLocaleString(),
    },
    {
      label: t("card.conversations"),
      value: metrics.sent.toLocaleString(),
      icon: <ChatsCircle weight="fill" />,
      color: "text-healthy",
    },
  ];

  const standardStats = [
    {
      label: t("table.dispatches"),
      value: metrics.dispatches.toLocaleString(),
      icon: <PaperPlaneTilt weight="fill" />,
      color: "text-foreground",
    },
    {
      label: t("card.asr"),
      value: `${Math.round(metrics.successRate)}%`,
      icon: <ChartLineUp weight="fill" />,
      color: metrics.successRate >= 70 ? "text-healthy" : metrics.successRate >= 40 ? "text-warning" : "text-destructive",
    },
    {
      label: t("card.delivered"),
      value: metrics.delivered.toLocaleString(),
      icon: <CheckCircle weight="fill" />,
      color: "text-healthy",
    },
    {
      label: t("card.read"),
      value: metrics.read.toLocaleString(),
      icon: <Eye weight="fill" />,
      color: "text-muted-foreground",
    },
    {
      label: t("card.failed"),
      value: metrics.failed.toLocaleString(),
      icon: <XCircle weight="fill" />,
      color: metrics.failed > 0 ? "text-destructive" : "text-muted-foreground",
    },
  ];

 

  // Category is shown as plain meta text (not a washed color chip): design
  // forbids bg-x/10 + text-x for meaning colors; solid chips live on the table.
  const tags = [
    {
      label:
        campaign.type === "organic"
          ? t("campaignType.organic")
          : t("campaignType.standard"),
      color:
        campaign.type === "organic" ? ("cyan" as const) : ("emerald" as const),
    },
    ...(campaign.enableAgentResponses
      ? [{ label: t("card.aiAgent"), color: "blue" as const }]
      : []),
    ...(campaign.enableAnalysis
      ? [{ label: t("card.analysis"), color: "purple" as const }]
      : []),
    ...(campaign.enableAutoStaging
      ? [{ label: t("card.autoTag"), color: "amber" as const }]
      : []),
    ...(metrics.notEligiblePossibleSpam && metrics.notEligiblePossibleSpam > 0
      ? [
          {
            label: `${metrics.notEligiblePossibleSpam} ${t("card.spam")}`,
            color: "rose" as const,
          },
        ]
      : []),
  ];

  return (
    <ListingCard
      badge={campaign.type === "organic" ? "ORG" : "WA"}
      badgeColor="emerald"
      title={campaign.name}
      subtitle={`${metrics.totalNumbers.toLocaleString()} ${t("card.contactsLabel")} • ${t("card.successRateLabel")} ${Math.round(metrics.successRate)}%`}
      status={
        isArchived
          ? {
              label: t("status.stopped"),
              color: "slate" as const,
              pulse: false,
            }
          : {
              label: t(status.labelKey),
              color: statusColorMap[campaign.status || "STOPPED"] || "slate",
              pulse: campaign.status === "RUNNING",
            }
      }
      tags={tags}
      metaItems={metaItems.length > 0 ? metaItems : undefined}
      progress={
        campaign.type === "organic"
          ? undefined
          : {
              value: Math.round(metrics.completionRate),
              color: "emerald",
              label: `${(metrics.sent + metrics.failed).toLocaleString()} / ${metrics.totalNumbers.toLocaleString()} ${t("card.processed")}`,
            }
      }
      stats={campaign.type === "organic" ? organicStats : standardStats}
      footerText={`${t("card.createdAt")} ${new Date(campaign.createdAt).toLocaleDateString()}`}
      primaryAction={primaryAction}
      menuItems={menuItems}
      accentColor="emerald"
    />
  );
}

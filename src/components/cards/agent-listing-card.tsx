"use client";

import {
  Archive,
  ArrowCounterClockwise,
  TestTube,
  Eye,
  PencilSimple,
  Robot,
} from "@/components/icons";

import type { Agent } from "@/lib/agents/types";
import { ListingCard } from "@/components/elevated-design/listing-card";
import { ModelBrandIcon } from "@/components/elevated-design/model-brand-icon";

interface AgentListingCardProps {
  agent: Agent;
  isArchived?: boolean;
  onArchive?: (agentId: string) => void;
  onUnarchive?: (agentId: string) => void;
  t: (key: string) => string;
}

export function AgentListingCard({
  agent,
  isArchived = false,
  onArchive,
  onUnarchive,
  t,
}: AgentListingCardProps) {
  const primaryAction = isArchived
    ? {
        label: t("card.unarchive"),
        icon: <ArrowCounterClockwise className="h-3.5 w-3.5" weight="bold" />,
        onClick: () => onUnarchive?.(agent.id),
      }
    : {
        label: t("card.simulate"),
        icon: <TestTube className="h-3.5 w-3.5" weight="bold" />,
        href: `/dashboard/agents/${agent.id}/simulator`,
      };

  const secondaryAction = isArchived
    ? undefined
    : {
        label: t("card.edit"),
        icon: <PencilSimple className="h-3.5 w-3.5" weight="bold" />,
        href: `/dashboard/agents/${agent.id}/edit`,
      };

  const menuItems = isArchived
    ? [
        {
          label: t("card.details"),
          icon: <Eye className="h-4 w-4" weight="bold" />,
          href: `/dashboard/agents/${agent.id}`,
        },
      ]
    : [
        {
          label: t("card.details"),
          icon: <Eye className="h-4 w-4" weight="bold" />,
          href: `/dashboard/agents/${agent.id}`,
        },
        {
          label: t("card.archive"),
          icon: <Archive className="h-4 w-4" weight="bold" />,
          onClick: () => onArchive?.(agent.id),
        },
      ];

  return (
    <ListingCard
      badge="AI"
      badgeColor="blue"
      icon={<Robot className="h-5 w-5" weight="fill" />}
      title={agent.name}
      subtitle={`${agent.provider} • ${agent.messagingModel}`}
      status={{
        label: isArchived
          ? t("card.status.inactive")
          : agent.isActive
            ? t("card.status.active")
            : t("card.status.inactive"),
        color: isArchived ? "slate" : agent.isActive ? "emerald" : "slate",
        pulse: !isArchived && agent.isActive,
      }}
      description={agent.description || t("card.noDescription")}
      stats={[
        {
          label: t("card.model"),
          value: agent.messagingModel ? (
            <span className="flex items-center justify-center gap-1.5">
              <ModelBrandIcon modelId={agent.messagingModel} size={14} />
              <span>{agent.messagingModel.split("/").pop()}</span>
            </span>
          ) : (
            "-"
          ),
        },
        { label: t("card.tags"), value: agent.tags?.length || 0 },
      ]}
      footerText={`${t("card.createdAt")} ${new Date(agent.createdAt).toLocaleDateString()}`}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      menuItems={menuItems}
      accentColor="blue"
    />
  );
}

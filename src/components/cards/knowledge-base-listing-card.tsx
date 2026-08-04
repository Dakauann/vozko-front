"use client";

import { Eye, Files, PencilSimple, Trash } from "@/components/icons";

import type { KnowledgeBase } from "@/lib/knowledge-base/types";
import { ListingCard } from "@/components/elevated-design/listing-card";

interface KnowledgeBaseListingCardProps {
  knowledgeBase: KnowledgeBase;
  onDelete?: (id: string) => void;
  t: (key: string) => string;
}

export function KnowledgeBaseListingCard({
  knowledgeBase,
  onDelete,
  t,
}: KnowledgeBaseListingCardProps) {
  const primaryAction = {
    label: t("card.view"),
    icon: <Eye className="h-3.5 w-3.5" weight="fill" />,
    href: `/dashboard/knowledge-bases/${knowledgeBase.id}`,
  };

  const secondaryAction = {
    label: t("card.edit"),
    icon: <PencilSimple className="h-3.5 w-3.5" weight="bold" />,
    href: `/dashboard/knowledge-bases/${knowledgeBase.id}/edit`,
  };

  const menuItems = [
    {
      label: t("card.view"),
      icon: <Eye className="h-4 w-4" weight="bold" />,
      href: `/dashboard/knowledge-bases/${knowledgeBase.id}`,
    },
    {
      label: t("card.edit"),
      icon: <PencilSimple className="h-4 w-4" weight="bold" />,
      href: `/dashboard/knowledge-bases/${knowledgeBase.id}/edit`,
    },
    {
      label: t("card.delete"),
      icon: <Trash className="h-4 w-4" weight="bold" />,
      onClick: () => onDelete?.(knowledgeBase.id),
    },
  ];

  const documentCount = knowledgeBase.documentCount ?? 0;
  const chunkCount = knowledgeBase.chunkCount ?? 0;
  const isActive = knowledgeBase.status === "active";

  return (
    <ListingCard
      badge="RAG"
      badgeColor="primary"
      icon={<Files className="h-5 w-5" weight="fill" />}
      title={knowledgeBase.name}
      subtitle={`${documentCount} ${t("card.documents")} • ${chunkCount} ${t("card.chunks")}`}
      status={{
        label: isActive ? t("card.status.active") : t("card.status.inactive"),
        color: isActive ? "emerald" : "slate",
        pulse: isActive,
      }}
      description={knowledgeBase.description || t("card.noDescription")}
      stats={[
        { label: t("card.documents"), value: documentCount },
        {
          label: t("card.chunks"),
          value: chunkCount,
          color: "primary",
        },
      ]}
      footerText={`${t("card.createdAt")} ${new Date(knowledgeBase.createdAt).toLocaleDateString()}`}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      menuItems={menuItems}
      accentColor="primary"
    />
  );
}

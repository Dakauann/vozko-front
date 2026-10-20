"use client";

import { useTranslations } from "next-intl";

import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { publicationChip, type PublicationFacts } from "@/lib/workflows/publication";
import type { WorkflowStatus } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

const STATUS_TONES: Record<WorkflowStatus, StatusChipTone> = {
  draft: "neutral",
  active: "healthy",
  paused: "warning",
  archived: "fault",
};

export function WorkflowPublicationChips({
  workflow,
  compact = false,
  className,
}: {
  workflow: PublicationFacts;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("workflowsPage");
  const chip = publicationChip(workflow);
  const chipClass = compact ? "px-2 text-2xs" : "px-2 text-xs";

  const statusLabel =
    chip.status === "draft"
      ? t("publication.draft")
      : chip.version !== null && chip.status === "active"
        ? t("publication.activeVersion", { version: chip.version })
        : chip.version !== null && chip.status === "paused"
          ? t("publication.pausedVersion", { version: chip.version })
          : t.has(`status.${chip.status}`)
            ? t(`status.${chip.status}`)
            : chip.status;

  const statusHint =
    chip.status === "draft"
      ? t("publication.draftHint")
      : chip.version !== null
        ? t("publication.liveHint", { version: chip.version })
        : undefined;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <span title={statusHint} className="inline-flex">
        <StatusChip tone={STATUS_TONES[chip.status] ?? "muted"} label={statusLabel} className={cn("whitespace-nowrap", chipClass)} />
      </span>
      {chip.unpublishedChanges && (
        <span title={t("publication.unpublishedChangesHint")} className="inline-flex">
          <StatusChip
            tone="outline"
            label={t("publication.unpublishedChanges")}
            icon={<span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />}
            className={cn("whitespace-nowrap", chipClass)}
          />
        </span>
      )}
    </span>
  );
}

"use client";

import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { SectionState } from "@/components/dashboard/attendance/section-state";
import { Clock, Heat, House, MapPin, Prohibit, Star, Users } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useInView } from "@/hooks/use-in-view";
import { useLeadSection } from "@/hooks/use-lead-section";
import type { LeadFilter } from "@/lib/leads/filters";
import { summaryTiles, toggleSummaryTile, type LeadSummaryTile, type LeadSummaryTileId } from "@/lib/leads/summary-tiles";
import { cn } from "@/lib/utils";

const TILE_ICONS: Record<LeadSummaryTileId, ReactNode> = {
  total: <Users className="h-4 w-4 text-info-ink" weight="fill" />,
  onMap: <MapPin className="h-4 w-4 text-healthy-ink" weight="fill" />,
  approximate: <Heat className="h-4 w-4 text-warning-ink" weight="fill" />,
  withoutAddress: <House className="h-4 w-4 text-muted-foreground" weight="fill" />,
  birthdaysToday: <Star className="h-4 w-4 text-info-ink" weight="fill" />,
  blocked: <Prohibit className="h-4 w-4 text-destructive-ink" weight="fill" />,
  windowOpen: <Clock className="h-4 w-4 text-healthy-ink" weight="fill" />,
};

export interface LeadStatsStripProps {
  filter: LeadFilter;
  search: string;
  onFilterChange: (filter: LeadFilter) => void;
}

export function LeadStatsStrip({ filter, search, onFilterChange }: LeadStatsStripProps) {
  const t = useTranslations("leadsPage.summary");
  const { can } = useWorkspace();
  const viewer = { readsAddresses: can("leads", "read_addresses") };
  const [ref, inView] = useInView<HTMLDivElement>();
  const summary = useLeadSection("summary", { filter, q: search }, { enabled: inView });

  return (
    <div ref={ref} className="flex min-w-0 flex-1 flex-wrap items-center gap-2" aria-busy={summary.isFetching}>
      <SectionState query={summary} message={t("failed")}>
        {summary.data ? (
          <div className={cn("flex flex-wrap items-center gap-1", summary.isPlaceholderData && "opacity-60")}>
            {summaryTiles(summary.data, filter, viewer).map((tile) => (
              <SummaryTile key={tile.id} tile={tile} onToggle={() => onFilterChange(toggleSummaryTile(filter, tile.id))} />
            ))}
          </div>
        ) : (
          <span className="px-2 py-1 text-xs text-muted-foreground">{t("loading")}</span>
        )}
      </SectionState>
    </div>
  );
}

function SummaryTile({ tile, onToggle }: { tile: LeadSummaryTile; onToggle: () => void }) {
  const t = useTranslations("leadsPage.summary");
  const format = useFormatter();
  const body = (
    <>
      {TILE_ICONS[tile.id]}
      <span className="whitespace-nowrap text-xs text-muted-foreground">{t(tile.id)}</span>
      <span
        className={cn(
          "whitespace-nowrap text-sm font-semibold tabular-nums text-foreground",
          tile.interactive && !tile.applied && "underline decoration-border-strong underline-offset-[3px]",
        )}
      >
        {format.number(tile.count)}
      </span>
    </>
  );

  if (!tile.interactive) {
    return <span className="inline-flex items-center gap-2 px-2 py-1">{body}</span>;
  }

  return (
    <button
      type="button"
      aria-pressed={tile.applied}
      title={tile.applied ? t("remove") : t("apply")}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-2 rounded-[--radius] px-2 py-1 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tile.applied ? "bg-muted text-foreground shadow-[inset_0_-2px_0_0_hsl(var(--primary))]" : "hover:bg-muted",
      )}
    >
      {body}
    </button>
  );
}

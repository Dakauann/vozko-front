"use client";

import type { ReactNode, Ref } from "react";
import { useTranslations } from "next-intl";

import { Users } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface StageTile {
  key: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  filter?: string;
}

const TILE_CLASS = "inline-flex items-center gap-2 rounded-[--radius] px-2 py-1";

function TileBody({ tile, underline }: { tile: StageTile; underline: boolean }) {
  return (
    <>
      {tile.icon}
      <span className="whitespace-nowrap text-xs text-muted-foreground">{tile.label}</span>
      <span className={cn("readout whitespace-nowrap text-sm font-semibold text-foreground", underline && "underline decoration-border-strong underline-offset-[3px]")}>{tile.value}</span>
      {tile.detail ? <span className="whitespace-nowrap text-2xs text-muted-foreground">{tile.detail}</span> : null}
    </>
  );
}

export function StageStrip({
  total,
  tiles,
  active = "",
  onFilter,
  anchor,
  overlay,
  ref,
  tour,
}: {
  total: ReactNode;
  tiles: StageTile[];
  active?: string;
  onFilter?: (filter: string) => void;
  anchor?: (key: string, node: HTMLElement | null) => void;
  overlay?: ReactNode;
  ref?: Ref<HTMLDivElement>;
  tour?: string;
}) {
  const t = useTranslations("campaignDetail.live");
  return (
    <div ref={ref} className="relative border-t border-border bg-card px-2 py-1.5 sm:px-3" data-tour={tour}>
      {overlay}
      <div className="flex flex-wrap items-center gap-1">
        <span className={TILE_CLASS}>
          <Users className="h-4 w-4 text-info-ink" weight="fill" />
          <span className="whitespace-nowrap text-xs text-muted-foreground">{t("total")}</span>
          <span className="readout whitespace-nowrap text-sm font-semibold text-foreground">{total}</span>
        </span>
        {tiles.map((tile) => {
          const filter = tile.filter;
          if (filter === undefined || !onFilter) {
            return (
              <span key={tile.key} ref={(node) => anchor?.(tile.key, node)} className={TILE_CLASS}>
                <TileBody tile={tile} underline={false} />
              </span>
            );
          }
          const applied = active === filter;
          return (
            <button
              key={tile.key}
              type="button"
              ref={(node) => anchor?.(tile.key, node)}
              aria-pressed={applied}
              title={applied ? t("clearFilter") : t("filterBy")}
              onClick={() => onFilter(applied ? "" : filter)}
              className={cn(
                TILE_CLASS,
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                applied ? "bg-muted text-foreground shadow-[inset_0_-2px_0_0_hsl(var(--primary))]" : "hover:bg-muted",
              )}
            >
              <TileBody tile={tile} underline={!applied} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LiveFact({ value, label, detail, emphasis = false }: { value: ReactNode; label: string; detail?: ReactNode; emphasis?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <b className={cn("readout truncate font-display font-semibold leading-tight text-foreground", emphasis ? "text-[28px]" : "text-lg")}>
        {value}
      </b>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      {detail ? <span className="truncate text-2xs text-muted-foreground">{detail}</span> : null}
    </div>
  );
}

export function LiveStamp({ live, children }: { live: boolean; children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-2xs text-muted-foreground" aria-live="polite">
      {live ? (
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-healthy opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-healthy" />
        </span>
      ) : null}
      {children}
    </p>
  );
}

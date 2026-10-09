"use client";

import { useId, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { RetryNotice } from "@/components/elevated-design/retry-notice";
import { ToneSwatch } from "@/components/elevated-design/tone-swatch";
import { Heat, House, Hourglass, Prohibit, WarningCircle, type Icon } from "@/components/icons";
import { offMapRows, type ColourLegendRow, type OffMapKey } from "@/lib/maps/summary";
import { cssTokenColor, toneCssColor } from "@/lib/tones/tones";
import type { GeoSummary, LeftOutDistrict } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

import { MapPanel } from "./MapPanel";

export interface GeoSummaryColour {
  field: string;
  rows: ColourLegendRow[];
  failed?: boolean;
}

export interface GeoLeftOutView {
  counts: { total: number; districts: readonly LeftOutDistrict[] } | null;
  failed?: boolean;
  busy?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  onList?: (pair?: string) => void;
}

export interface GeoSummaryPanelProps {
  summary: GeoSummary | null;
  areaNames: readonly string[];
  colour?: GeoSummaryColour | null;
  offMapActions?: Partial<Record<OffMapKey, () => void>>;
  leftOut?: GeoLeftOutView | null;
  failed?: boolean;
  busy?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  children?: ReactNode;
  className?: string;
}

const OFF_MAP_ICONS: Record<OffMapKey, Icon> = {
  approximate: Heat,
  withoutAddress: House,
  notFound: WarningCircle,
  pending: Hourglass,
  quotaExceeded: Prohibit,
  refused: WarningCircle,
};

function PanelBlock({ title, aside, children, className }: { title: string; aside?: string; children: ReactNode; className?: string }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={cn("-mx-3.5 flex flex-col gap-2 border-b border-border px-3.5 py-2.5 last:border-b-0", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={titleId} className="legend">
          {title}
        </h3>
        {aside ? <span className="legend">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

const LINK = "rounded-sm font-semibold tabular-nums text-foreground underline decoration-border-strong underline-offset-[3px] hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function LeftOutNote({ view, areas }: { view: GeoLeftOutView; areas: number }) {
  const t = useTranslations("leadMap.panel.leftOut");
  const tCommon = useTranslations("metricsOps.common");
  const format = useFormatter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const { counts, onList } = view;

  if (view.failed) {
    return (
      <RetryNotice
        className="text-xs"
        message={view.busy ? tCommon("sectionBusy") : t("failed")}
        retryLabel={tCommon("retry")}
        onRetry={view.onRetry}
        retrying={view.retrying}
      />
    );
  }
  if (!counts) return <span aria-hidden="true" className="block h-4 w-48 animate-pulse rounded-md bg-muted" />;
  if (counts.total === 0) return <p className="text-xs text-muted-foreground">{t("none", { areas })}</p>;

  return (
    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      <p>{t("summary", { count: counts.total, areas })}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {onList ? (
          <button type="button" onClick={() => onList()} aria-label={t("listAll", { count: counts.total })} className={LINK}>
            {t("list")}
          </button>
        ) : null}
        {counts.districts.length > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            className="rounded-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("byDistrict")}
          </button>
        ) : null}
      </div>
      {open ? (
        <ul id={listId} aria-label={t("districtsLabel")} className="flex flex-col gap-1">
          {counts.districts.map((district) => (
            <li key={district.pair} className="flex items-baseline gap-2 text-sm text-foreground">
              <span className="min-w-0 truncate">{district.name}</span>
              <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">{district.city}</span>
              {onList ? (
                <button
                  type="button"
                  onClick={() => onList(district.pair)}
                  aria-label={t("districtAction", { count: district.count, name: district.name })}
                  className={LINK}
                >
                  {format.number(district.count)}
                </button>
              ) : (
                <span className="font-semibold tabular-nums">{format.number(district.count)}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function GeoSummaryPanel({
  summary,
  areaNames,
  colour = null,
  offMapActions = {},
  leftOut = null,
  failed = false,
  busy = false,
  onRetry,
  retrying = false,
  children,
  className,
}: GeoSummaryPanelProps) {
  const t = useTranslations("leadMap.panel");
  const tCommon = useTranslations("metricsOps.common");
  const format = useFormatter();
  const number = (value: number) => format.number(value);

  const caption = (total: number) =>
    areaNames.length === 0
      ? t("leadsInFilter", { count: total })
      : areaNames.length === 1
        ? t("leadsInArea", { count: total, name: areaNames[0] })
        : t("leadsInAreas", { count: total, areas: areaNames.length });

  const colourTotal = colour ? colour.rows.reduce((sum, row) => sum + row.count, 0) : 0;

  return (
    <MapPanel title={t("title")} className={className} defaultExpanded={false}>
      <PanelBlock title={areaNames.length > 0 ? t("inArea") : t("inFilter")} className="gap-1 py-3">
        {summary ? (
          <p className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-display text-2xl font-semibold tabular-nums text-foreground">{number(summary.total)}</span>
            <span className="text-sm text-muted-foreground">{caption(summary.total)}</span>
          </p>
        ) : failed ? (
          <RetryNotice
            className="text-xs"
            message={busy ? tCommon("sectionBusy") : t("summaryFailed")}
            retryLabel={tCommon("retry")}
            onRetry={onRetry}
            retrying={retrying}
          />
        ) : (
          <span aria-hidden="true" className="block h-8 w-28 animate-pulse rounded-md bg-muted" />
        )}
      </PanelBlock>

      {colour ? (
        <PanelBlock title={t("colouredBy", { field: colour.field })} aside={t("leadsColumn")}>
          {colour.failed ? (
            <RetryNotice className="text-xs" message={t("colourFailed", { field: colour.field })} retryLabel={tCommon("retry")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {colour.rows.map((row) => (
                <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                    <ToneSwatch tone={row.tone} />
                    <span className="truncate">{row.label ?? t("notInformed")}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">{number(row.count)}</span>
                  <span aria-hidden="true" className="col-span-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${colourTotal > 0 ? (row.count / colourTotal) * 100 : 0}%`,
                        backgroundColor: row.tone === "neutral" ? cssTokenColor("--control-edge") : toneCssColor(row.tone),
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelBlock>
      ) : null}

      {summary ? (
        <PanelBlock title={t("offMap")}>
          <ul className="flex flex-col gap-1.5">
            {offMapRows(summary).map((row) => {
              const RowIcon = OFF_MAP_ICONS[row.key];
              const action = offMapActions[row.key];
              const label = t(`offMapRows.${row.key}`);
              const count = number(row.count);
              return (
                <li key={row.key} className="flex items-center gap-2 text-sm">
                  <RowIcon size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {action ? (
                    <button
                      type="button"
                      onClick={action}
                      title={t(`offMapActions.${row.key}`)}
                      aria-label={t("offMapActionLabel", { label, count, action: t(`offMapActions.${row.key}`) })}
                      className={LINK}
                    >
                      {count}
                    </button>
                  ) : (
                    <span className="font-semibold tabular-nums text-foreground">{count}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {leftOut ? <LeftOutNote view={leftOut} areas={areaNames.length} /> : null}
        </PanelBlock>
      ) : null}

      {children ? <PanelBlock title={t("districts")} aside={t("districtsColumn")}>{children}</PanelBlock> : null}
    </MapPanel>
  );
}

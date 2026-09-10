"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { EChartsOption } from "echarts";
import { allocateWaffle } from "@/lib/charts/data";
import { cn } from "@/lib/utils";

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

// ZRender requires resolved colours, so CSS tokens are read again on theme changes.
function resolveColors(value: unknown, styles: CSSStyleDeclaration): unknown {
  if (typeof value === "string") {
    return value.replace(/hsl\(var\((--[\w-]+)\)(?:\s*\/\s*([\d.]+))?\)/g, (_, token: string, alpha?: string) => {
      const channels = styles.getPropertyValue(token).trim().split(/\s+/).join(", ");
      return alpha ? `hsla(${channels}, ${alpha})` : `hsl(${channels})`;
    });
  }
  if (Array.isArray(value)) return value.map((item) => resolveColors(item, styles));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveColors(item, styles)]));
  }
  return value;
}

export function DataChart({ option, label, height = 210, rows, columns }: {
  option: EChartsOption;
  label: string;
  height?: number;
  rows: (string | number)[][];
  columns: string[];
}) {
  const t = useTranslations("denseCharts");
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    import("./echarts-runtime").then(({ init }) => {
      if (cancelled) return;
      const chart = init(element, undefined, { renderer: "svg" });
      const render = () => {
        const styles = getComputedStyle(element);
        chart.setOption(resolveColors({
          ...option,
          animation: false,
          textStyle: { fontFamily: styles.fontFamily, fontSize: 11, color: "hsl(var(--muted-foreground))" },
          tooltip: {
            trigger: "item", confine: true, renderMode: "richText",
            backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))",
            textStyle: { color: "hsl(var(--popover-foreground))", fontSize: 12 },
            ...option.tooltip,
          },
        }, styles) as EChartsOption, { notMerge: true });
      };
      try {
        render();
      } catch (error) {
        chart.dispose();
        throw error;
      }
      const resize = new ResizeObserver(() => chart.resize());
      resize.observe(element);
      const theme = new MutationObserver(render);
      theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
      dispose = () => { resize.disconnect(); theme.disconnect(); chart.dispose(); };
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; dispose?.(); };
  }, [option]);

  return (
    <div className="min-w-0">
      {failed ? <p className="py-3 text-xs text-muted-foreground">{t("unavailable")}</p> : null}
      <div ref={host} role="img" aria-label={label} className={cn("w-full min-w-0", failed && "hidden")} style={{ height }} />
      <details className="group mt-1 text-2xs" open={failed || undefined}>
        <summary className="w-fit cursor-pointer rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("viewData")}</summary>
        <div className="mt-2 max-h-52 overflow-auto rounded border border-border">
          <table className="w-full text-left text-xs tabular-nums">
            <caption className="sr-only">{label}</caption>
            <thead className="sticky top-0 bg-muted"><tr>{columns.map((column) => <th key={column} scope="col" className="px-2 py-1.5 font-medium">{column}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={index} className="border-t border-border">{row.map((cell, i) => <td key={i} className="px-2 py-1.5">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function ChartLegend({ data, total }: { data: ChartDatum[]; total?: number }) {
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale);
  const pf = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  return <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
    {data.map((item) => <li key={item.key} className="flex min-w-0 items-center gap-1.5 text-2xs">
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ background: item.color }} />
      <span className="min-w-0 flex-1 truncate text-muted-foreground" title={item.label}>{item.label}</span>
      <span className="shrink-0 font-semibold tabular-nums">{nf.format(item.value)}</span>
      {total !== undefined ? <span className="shrink-0 tabular-nums text-muted-foreground">{pf.format(total > 0 ? item.value / total : 0)}</span> : null}
    </li>)}
  </ul>;
}

export function WaffleChart({ data, label, compact = false }: { data: ChartDatum[]; label: string; compact?: boolean }) {
  const t = useTranslations("denseCharts");
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const allocations = allocateWaffle(data.map((item) => item.value));
  const squares = data.flatMap((item, i) => Array.from({ length: allocations[i] }, () => item));
  return <div className="space-y-2">
    <div role="img" aria-label={`${label}. ${data.map((item) => `${item.label}: ${item.value}`).join(", ")}`} className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]">
      {Array.from({ length: 100 }, (_, i) => <span key={i} className={cn("rounded-[2px] bg-muted", compact ? "h-2" : "h-4")} style={{ backgroundColor: squares[i]?.color }} />)}
    </div>
    <ChartLegend data={data} total={total} />
    {!compact ? <p className="text-2xs text-muted-foreground">{t("waffleHint")}</p> : null}
  </div>;
}

/** A real dated series. Missing buckets break the path instead of inventing zeroes. */
export function Sparkline({ points, label, color = "hsl(var(--chart-1))", domain, className }: {
  points: { date: string; value: number | null }[];
  label: string;
  color?: string;
  domain?: [number, number];
  className?: string;
}) {
  const id = useId();
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const valid = data.filter((point) => point.value !== null && Number.isFinite(point.value));
  if (!valid.length) return <div className={cn("h-8 border-b border-dashed border-border", className)} aria-hidden />;
  const min = domain?.[0] ?? 0;
  const max = domain?.[1] ?? Math.max(...valid.map((point) => point.value!), 1);
  const first = Date.parse(data[0].date);
  const last = Date.parse(data[data.length - 1].date);
  const x = (date: string) => 3 + (last > first ? (Date.parse(date) - first) / (last - first) * 154 : 77);
  const y = (value: number) => 29 - Math.max(0, Math.min(1, (value - min) / (max - min || 1))) * 25;
  const path = data.map((point, index) => {
    const previous = data[index - 1];
    const contiguous = previous?.value != null && Number.isFinite(previous.value) && Date.parse(point.date) - Date.parse(previous.date) <= 86400000;
    if (point.value === null || !Number.isFinite(point.value)) return "";
    return `${contiguous ? "L" : "M"}${x(point.date).toFixed(1)},${y(point.value).toFixed(1)}`;
  }).join(" ");
  return <svg viewBox="0 0 160 34" role="img" aria-labelledby={id} className={cn("h-8 w-full overflow-visible", className)} preserveAspectRatio="none">
    <title id={id}>{label}</title>
    <path d="M3 30H157" stroke="hsl(var(--border))" strokeDasharray="2 4" />
    <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    {valid.map((point) => <circle key={point.date} cx={x(point.date)} cy={y(point.value!)} r={valid.length === 1 ? 3 : 1.5} fill={color} />)}
  </svg>;
}

"use client";

import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { vozGrid, vozLineMark, vozXAxis, vozYAxis } from "@/components/charts/vozko";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { DailyPoint } from "@/lib/carrier-messaging/analytics";
import type { CampaignChannel } from "@/lib/carrier-messaging/campaigns";
import { useMicrosMoney } from "@/lib/carrier-messaging/use-micros-money";

import { CHANNEL_COLOR, useCountText } from "./carrier-query";

type DayRow = { day: string; label: string } & Partial<Record<`${CampaignChannel}_sent` | `${CampaignChannel}_spend`, number>>;

function pivot(daily: readonly DailyPoint[], label: (day: string) => string): { rows: DayRow[]; channels: CampaignChannel[] } {
  const byDay = new Map<string, DayRow>();
  const channels = new Set<CampaignChannel>();
  for (const point of [...daily].sort((a, b) => a.day.localeCompare(b.day))) {
    const row = byDay.get(point.day) ?? { day: point.day, label: label(point.day) };
    row[`${point.channel}_sent`] = point.sent;
    row[`${point.channel}_spend`] = point.spend_micros;
    channels.add(point.channel);
    byDay.set(point.day, row);
  }
  return { rows: [...byDay.values()], channels: (["rcs", "sms"] as const).filter((channel) => channels.has(channel)) };
}

function dayDate(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

export function DailyCharts({ daily }: { daily: readonly DailyPoint[] }) {
  const t = useTranslations("carrierMessaging.pages.overview.daily");
  const tChannels = useTranslations("carrierMessaging.channels");
  const format = useFormatter();
  const count = useCountText();
  const money = useMicrosMoney();
  const { rows, channels } = useMemo(() => pivot(daily, (day) => format.dateTime(dayDate(day), { day: "2-digit", month: "short" })), [daily, format]);

  const volumeConfig: ChartConfig = Object.fromEntries(channels.map((channel) => [`${channel}_sent`, { label: tChannels(channel), color: CHANNEL_COLOR[channel] }]));
  const spendConfig: ChartConfig = Object.fromEntries(channels.map((channel) => [`${channel}_spend`, { label: tChannels(channel), color: CHANNEL_COLOR[channel] }]));

  if (rows.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <figure className="min-w-0">
        <figcaption className="legend mb-2">{t("volume")}</figcaption>
        <ChartContainer config={volumeConfig} className="aspect-auto h-60 w-full" aria-label={t("volume")}>
          <BarChart data={rows} margin={{ top: 4, right: 8, left: -12, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid {...vozGrid} />
            <XAxis dataKey="label" minTickGap={16} {...vozXAxis} />
            <YAxis allowDecimals={false} {...vozYAxis} tickFormatter={(value: number) => count(value)} />
            <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent formatter={(value, name) => <TooltipRow label={String(volumeConfig[String(name)]?.label ?? name)} color={volumeConfig[String(name)]?.color} value={count(Number(value))} />} />} />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
            {channels.map((channel, index) => (
              <Bar
                key={channel}
                dataKey={`${channel}_sent`}
                stackId="sent"
                fill={CHANNEL_COLOR[channel]}
                stroke="hsl(var(--card))"
                strokeWidth={index > 0 ? 2 : 0}
                radius={index === channels.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </figure>
      <figure className="min-w-0">
        <figcaption className="legend mb-2">{t("spend")}</figcaption>
        <ChartContainer config={spendConfig} className="aspect-auto h-60 w-full" aria-label={t("spend")}>
          <LineChart data={rows} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid {...vozGrid} />
            <XAxis dataKey="label" minTickGap={16} {...vozXAxis} />
            <YAxis {...vozYAxis} width={64} tickFormatter={(value: number) => money(value) ?? ""} />
            <ChartTooltip
              cursor={{ stroke: "hsl(var(--border-strong))", strokeWidth: 1 }}
              content={<ChartTooltipContent formatter={(value, name) => <TooltipRow label={String(spendConfig[String(name)]?.label ?? name)} color={spendConfig[String(name)]?.color} value={money(Number(value)) ?? t("spendUnavailable")} />} />}
            />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
            {channels.map((channel) => (
              <Line key={channel} type="linear" dataKey={`${channel}_spend`} stroke={CHANNEL_COLOR[channel]} {...vozLineMark} strokeWidth={2} isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ChartContainer>
      </figure>
      <details className="text-2xs xl:col-span-2">
        <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("viewData")}</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-[--radius] border border-border">
          <table className="w-full text-left text-xs tabular-nums">
            <caption className="sr-only">{t("tableCaption")}</caption>
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-medium">{t("day")}</th>
                {channels.map((channel) => (
                  <th key={`${channel}-sent`} scope="col" className="px-2 py-1.5 font-medium">{t("sentOn", { channel: tChannels(channel) })}</th>
                ))}
                {channels.map((channel) => (
                  <th key={`${channel}-spend`} scope="col" className="px-2 py-1.5 font-medium">{t("spendOn", { channel: tChannels(channel) })}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.day} className="border-t border-border">
                  <td className="px-2 py-1.5">{row.label}</td>
                  {channels.map((channel) => (
                    <td key={`${channel}-sent`} className="px-2 py-1.5">{count(row[`${channel}_sent`] ?? 0)}</td>
                  ))}
                  {channels.map((channel) => (
                    <td key={`${channel}-spend`} className="px-2 py-1.5">{money(row[`${channel}_spend`] ?? 0) ?? t("spendUnavailable")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function TooltipRow({ label, color, value }: { label: string; color?: string; value: string }) {
  return (
    <span className="flex w-full items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </span>
  );
}

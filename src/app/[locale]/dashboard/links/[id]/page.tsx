"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ArrowSquareOut,
  CircleNotch,
  CursorClick,
  DownloadSimple,
  GlobeHemisphereWest,
  LinkSimple,
  PencilSimple,
  Users,
} from "@/components/icons";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  downloadQr,
  getLink,
  getLinkAnalytics,
  getLinkClicks,
  qrImageUrl,
} from "@/app/actions/links";
import type {
  Click,
  DimensionCount,
  LinkAnalytics,
  ShortLink,
} from "@/lib/links/types";
import { useWorkspace } from "@/contexts/workspace-context";

import { CopyButton } from "../_components/CopyButton";

const ACCENT = "#2463eb";

function DistributionCard({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: DimensionCount[];
  emptyLabel: string;
}) {
  const max = items.reduce((acc, item) => Math.max(acc, item.clicks), 0) || 1;
  return (
    <ElevatedContainer className="border border-border" contentClassName="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.slice(0, 6).map((item) => (
            <li key={item.label || "unknown"} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate text-foreground">
                  {item.label || emptyLabel}
                </span>
                <span className="ml-2 shrink-0 font-medium text-muted-foreground">
                  {item.clicks}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.clicks / max) * 100}%`,
                    backgroundColor: ACCENT,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </ElevatedContainer>
  );
}

export default function LinkAnalyticsPage() {
  const t = useTranslations("links");
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id ?? "");
  const { currentWorkspace, isLoading: workspaceLoading, can } = useWorkspace();

  const [link, setLink] = useState<ShortLink | null>(null);
  const [analytics, setAnalytics] = useState<LinkAnalytics | null>(null);
  const [clicks, setClicks] = useState<Click[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceLoading || !currentWorkspace?.id || !id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [linkResult, analyticsResult, clicksResult] = await Promise.all([
        getLink(id),
        getLinkAnalytics(id),
        getLinkClicks(id, 1, 20),
      ]);
      if (cancelled) return;
      if (linkResult.error) {
        setError(linkResult.error);
      } else {
        setError(null);
        setLink(linkResult.link ?? null);
        setAnalytics(analyticsResult.analytics ?? null);
        setClicks(clicksResult.items);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, currentWorkspace?.id, workspaceLoading]);

  const chartConfig: ChartConfig = useMemo(
    () => ({ clicks: { label: t("stats.totalClicks"), color: ACCENT } }),
    [t],
  );

  const clickColumns: DashboardTableColumn<Click>[] = [
    {
      header: t("clicks.when"),
      key: "when",
      render: (row) => (
        <span className="text-sm text-foreground">
          {new Date(row.occurredAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: t("clicks.location"),
      key: "location",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {[row.city, row.region, row.country].filter(Boolean).join(", ") || "·"}
        </span>
      ),
    },
    {
      header: t("clicks.device"),
      key: "device",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {[row.browser, row.os, row.deviceType].filter(Boolean).join(" · ") || "·"}
        </span>
      ),
    },
    {
      header: t("clicks.referrer"),
      key: "referrer",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.refererDomain || t("clicks.direct")}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <CircleNotch className="h-6 w-6 animate-spin" weight="bold" />
      </div>
    );
  }

  if (error || !link) {
    return (
      <p className="py-24 text-center text-sm text-muted-foreground">
        {error ?? t("edit.notFound")}
      </p>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full space-y-6"
    >
      <DashboardPageHeader
        icon={<LinkSimple className="h-4 w-4" weight="bold" />}
        badge={t("header.badge")}
        title={link.title || link.code}
        description={link.targetUrl}
        back={{ onClick: () => router.push("/dashboard/links"), label: t("detail.back") }}
        actions={
          can("short_links", "update") ? (
            <Button
              variant="secondary"
              title={t("actions.edit")}
              icon={<PencilSimple className="h-4 w-4" weight="bold" />}
              iconVisible
              onClick={() => router.push(`/dashboard/links/${id}/edit`)}
            />
          ) : undefined
        }
      />

      <ElevatedContainer
        className="border border-border"
        contentClassName="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("detail.shortUrl")}
          </p>
          <div className="flex items-center gap-2">
            <code className="truncate rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground">
              {link.shortUrl}
            </code>
            <CopyButton
              value={link.shortUrl ?? ""}
              label={t("actions.copy")}
              copiedLabel={t("toast.copied")}
            />
            <a
              href={link.shortUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t("actions.open")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowSquareOut className="h-4 w-4" weight="bold" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <img
            src={qrImageUrl(id, currentWorkspace?.id ?? "", 256)}
            alt={t("detail.qrAlt")}
            width={96}
            height={96}
            className="h-24 w-24 rounded-[--radius] border border-border bg-white p-1"
          />
          <Button
            variant="outline"
            title={t("detail.downloadQr")}
            icon={<DownloadSimple className="h-4 w-4" weight="bold" />}
            iconVisible
            onClick={() => {
              downloadQr(id, currentWorkspace?.id ?? "", link.code).catch(() =>
                toast.error(t("detail.qrError")),
              );
            }}
          />
        </div>
      </ElevatedContainer>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<CursorClick className="h-4 w-4 text-info-ink" weight="fill" />}
          label={t("stats.totalClicks")}
          value={analytics?.totalClicks ?? link.clickCount}
        />
        <StatTile
          icon={<Users className="h-4 w-4 text-healthy-ink" weight="fill" />}
          label={t("stats.uniqueClicks")}
          value={analytics?.uniqueClicks ?? link.uniqueClickCount}
        />
        <StatTile
          icon={<GlobeHemisphereWest className="h-4 w-4 text-muted-foreground" weight="fill" />}
          label={t("stats.topCountry")}
          value={analytics?.byCountry?.[0]?.label || "·"}
        />
        <StatTile
          icon={<LinkSimple className="h-4 w-4 text-muted-foreground" weight="fill" />}
          label={t("stats.topReferrer")}
          value={analytics?.byReferer?.[0]?.label || t("clicks.direct")}
        />
      </div>

      <ElevatedContainer className="border border-border" contentClassName="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t("detail.overTime")}
        </h2>
        {analytics && analytics.timeSeries.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <AreaChart data={analytics.timeSeries} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e7ef" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={10} />
              <YAxis tickLine={false} axisLine={false} fontSize={10} allowDecimals={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="clicks"
                type="monotone"
                stroke={ACCENT}
                fill={ACCENT}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("detail.noClicks")}
          </p>
        )}
      </ElevatedContainer>

      <div className="grid gap-4 lg:grid-cols-3">
        <DistributionCard
          title={t("detail.byCountry")}
          items={analytics?.byCountry ?? []}
          emptyLabel={t("detail.unknown")}
        />
        <DistributionCard
          title={t("detail.byDevice")}
          items={analytics?.byDevice ?? []}
          emptyLabel={t("detail.unknown")}
        />
        <DistributionCard
          title={t("detail.byReferrer")}
          items={analytics?.byReferer ?? []}
          emptyLabel={t("clicks.direct")}
        />
        <DistributionCard
          title={t("detail.byBrowser")}
          items={analytics?.byBrowser ?? []}
          emptyLabel={t("detail.unknown")}
        />
        <DistributionCard
          title={t("detail.byOs")}
          items={analytics?.byOs ?? []}
          emptyLabel={t("detail.unknown")}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("detail.recentClicks")}
        </h2>
        <DashboardTable<Click>
          data={clicks}
          columns={clickColumns}
          rowKey={(row) => row.id}
          emptyState={{
            icon: <CursorClick className="h-7 w-7 text-muted-foreground" weight="fill" />,
            title: t("detail.noClicks"),
          }}
        />
      </div>
    </motion.main>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[--radius] border border-border bg-card p-4 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

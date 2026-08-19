"use client";

import {
  CheckCircle,
  CircleNotch,
  Clock,
  CurrencyDollar,
  XCircle,
} from "@/components/icons";
import type { Icon } from "@/components/icons";
import { motion } from "framer-motion";
import { useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { listAffiliateEarningsAction } from "@/app/actions/affiliate";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import type { AffiliateEarning, PaginationMeta } from "@/lib/affiliate/types";

const PAGE_SIZE = 20;


function usdFromMicros(micros: number): number {
  return micros / 1_000_000;
}

function brlFromEarning(row: AffiliateEarning): number {
  const rate = row.exchangeRateMicros / 1_000_000;
  return usdFromMicros(row.amountMicros) * rate;
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}


const STATUS_CONFIG: Record<
  string,
  { icon: Icon; className: string; fallbackLabel: string }
> = {
  pending: {
    icon: Clock,
    className: "bg-muted text-warning-ink border-border",
    fallbackLabel: "Pending",
  },
  paid: {
    icon: CheckCircle,
    className: "bg-muted text-healthy-ink border-border",
    fallbackLabel: "Paid",
  },
  cancelled: {
    icon: XCircle,
    className: "bg-muted text-destructive-ink border-border",
    fallbackLabel: "Cancelled",
  },
};


export default function AffiliateEarningsPage() {
  const t = useTranslations("affiliatePage.earnings");
  const headerT = useTranslations("affiliatePage");
  const locale = useLocale();
  const router = useRouter();

  const [rows, setRows] = useState<AffiliateEarning[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await listAffiliateEarningsAction(page, PAGE_SIZE);
      if (cancelled) return;
      if (res.error) {
        if (/404|not\s*found|não\s*encontrado/i.test(res.error)) {
          router.replace("/dashboard/affiliate");
          return;
        }
        setError(res.error);
        setRows([]);
      } else {
        setRows(res.items);
        setMeta(res.meta);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [page, router]);

  const formatDate = useCallback(
    (value: string) =>
      new Date(value).toLocaleDateString(locale === "pt" ? "pt-BR" : locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [locale],
  );

  const pageTotals = useMemo(() => {
    let totalUsd = 0;
    let paidUsd = 0;
    let pendingUsd = 0;
    for (const row of rows) {
      const usd = usdFromMicros(row.amountMicros);
      totalUsd += usd;
      const status = row.status.toLowerCase();
      if (status === "paid") paidUsd += usd;
      else if (status === "pending") pendingUsd += usd;
    }
    return { totalUsd, paidUsd, pendingUsd };
  }, [rows]);

  const columns = useMemo<DashboardTableColumn<AffiliateEarning>[]>(
    () => [
      {
        key: "date",
        header: t("table.date"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.createdAt)}
          </span>
        ),
      },
      {
        key: "purpose",
        header: t("table.purpose"),
        render: (row) => (
          <span className="inline-flex items-center rounded-[--radius] border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {row.purpose || "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: t("table.status"),
        render: (row) => {
          const key = row.status.toLowerCase();
          const cfg = STATUS_CONFIG[key] ?? STATUS_CONFIG.pending;
          const StatusIcon = cfg.icon;
          const known = key in STATUS_CONFIG;
          const label = known ? t(`status.${key}`) : cfg.fallbackLabel;
          return (
            <span
              className={`inline-flex items-center gap-1 rounded-[--radius] border px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}
            >
              <StatusIcon className="h-3 w-3" weight="fill" />
              {label}
            </span>
          );
        },
      },
      {
        key: "amountUsd",
        header: t("table.amountUSD"),
        className: "text-right",
        render: (row) => (
          <span className="text-sm font-medium tabular-nums text-foreground">
            {formatUSD(usdFromMicros(row.amountMicros))}
          </span>
        ),
      },
      {
        key: "amountBrl",
        header: t("table.amountBRL"),
        className: "text-right",
        render: (row) => (
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium tabular-nums text-foreground">
              {formatBRL(brlFromEarning(row))}
            </span>
            <span className="text-2xs text-muted-foreground">
              @{(row.exchangeRateMicros / 1_000_000).toFixed(4)}
            </span>
          </div>
        ),
      },
    ],
    [t, formatDate],
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      <DashboardPageHeader
        icon={<CurrencyDollar className="h-5 w-5" weight="fill" />}
        badge={headerT("earnings.headerBadge")}
        description={headerT("earnings.headerDescription")}
      />

      {error ? (
        <div className="rounded-[--radius] border border-border bg-muted p-4 text-sm text-destructive-ink">
          {error}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <CircleNotch
            className="h-8 w-8 animate-spin text-primary-ink"
            weight="bold"
          />
        </div>
      ) : (
        <DashboardTable<AffiliateEarning>
          data={rows}
          columns={columns}
          rowKey={(row) => row.id}
          loading={loading}
          stats={[
            {
              label: t("stats.recordsTotal"),
              value: meta.totalItems,
            },
            {
              label: t("stats.pagePaid"),
              value: formatUSD(pageTotals.paidUsd),
            },
            {
              label: t("stats.pagePending"),
              value: formatUSD(pageTotals.pendingUsd),
            },
          ]}
          pagination={{
            currentPage: meta.page,
            totalPages: Math.max(1, meta.totalPages),
            pageSize: meta.pageSize,
            totalItems: meta.totalItems,
            onPageChange: setPage,
          }}
          emptyState={{
            icon: <CurrencyDollar className="h-8 w-8" weight="fill" />,
            title: t("empty.title"),
            description: t("empty.description"),
          }}
        />
      )}
    </motion.main>
  );
}

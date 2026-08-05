"use client";

import { CircleNotch, UsersFour } from "@/components/icons";
import { motion } from "framer-motion";
import { useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { listAffiliateReferralsAction } from "@/app/actions/affiliate";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import type { AffiliateReferral, PaginationMeta } from "@/lib/affiliate/types";

const PAGE_SIZE = 15;

export default function AffiliateReferralsPage() {
  const t = useTranslations("affiliatePage.referrals");
  const headerT = useTranslations("affiliatePage");
  const locale = useLocale();
  const router = useRouter();

  const [rows, setRows] = useState<AffiliateReferral[]>([]);
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
      const res = await listAffiliateReferralsAction(page, PAGE_SIZE);
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

  const columns = useMemo<DashboardTableColumn<AffiliateReferral>[]>(
    () => [
      {
        key: "workspace",
        header: t("table.workspace"),
        render: (row) => (
          <span className="font-mono text-xs text-foreground">
            {row.workspaceId}
          </span>
        ),
      },
      {
        key: "date",
        header: t("table.date"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.referredAt)}
          </span>
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
        icon={<UsersFour className="h-5 w-5" weight="fill" />}
        badge={headerT("referrals.headerBadge")}
        description={headerT("referrals.headerDescription")}
      />

      {error ? (
        <div className="rounded-[--radius] border border-destructive/30 bg-muted p-4 text-sm text-destructive-ink">
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
        <DashboardTable<AffiliateReferral>
          data={rows}
          columns={columns}
          rowKey={(row) => row.id}
          loading={loading}
          stats={[
            {
              label: t("stats.total"),
              value: meta.totalItems,
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
            icon: <UsersFour className="h-8 w-8" weight="fill" />,
            title: t("empty.title"),
            description: t("empty.description"),
          }}
        />
      )}
    </motion.main>
  );
}

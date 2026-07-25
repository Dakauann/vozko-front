"use client"

import {
  Calendar,
  FunnelSimple,
  Phone,
  Users,
  WhatsappLogo,
} from "@phosphor-icons/react"
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select"
import { listLeadsV2Action } from "@/app/actions/leads"
import { useCallback, useEffect, useMemo, useState } from "react"

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader"
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import type { LeadListItem } from "@/lib/leads/types"

function formatDate(value: string | undefined | null, locale: string): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

function windowBadgeClass(open: boolean): string {
  return open
    ? "bg-emerald-500 text-white"
    : "bg-slate-500 text-white"
}

export default function LeadsPage() {
  const t = useTranslations("leadsPage")
  const locale = useLocale()

  const [items, setItems] = useState<LeadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [whatsAppFilter, setWhatsAppFilter] = useState<string>("all")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const params: Record<string, string | number | boolean> = { page: currentPage, pageSize: 20 }
        if (whatsAppFilter !== "all") params.hasWhatsAppCampaign = whatsAppFilter === "true"

        const result = await listLeadsV2Action(params as any)
        if (cancelled) return
        if (result.error) setError(result.error)
        else {
          setItems(result.items)
          setTotalPages(result.meta.totalPages)
          setTotalItems(result.meta.totalItems)
          setError(null)
        }
      } catch {
        if (!cancelled) setError("Failed to load leads")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [currentPage, whatsAppFilter])

  const summary = useMemo(() => {
    const withWhatsApp = items.filter((i) => i.whatsappCampaigns > 0).length
    return { withWhatsApp }
  }, [items])

  const columns = useMemo<DashboardTableColumn<LeadListItem>[]>(() => [
    {
      key: "number",
      header: t("table.number"),
      render: (row) => (
        <Link href={`/dashboard/leads/${row.id}`} className="text-sm text-foreground font-mono hover:underline">
          {row.number}
        </Link>
      ),
    },
    {
      key: "name",
      header: t("table.name"),
      render: (row) => <span className="text-sm text-foreground">{row.name || "—"}</span>,
    },
    {
      key: "campaigns",
      header: t("table.campaigns"),
      render: (row) => (
        <span className="text-sm text-foreground tabular-nums">
          <span className="inline-flex items-center gap-1"><WhatsappLogo weight="fill" className="text-emerald-500" size={12} />{row.whatsappCampaigns}</span>
        </span>
      ),
    },
    {
      key: "window",
      header: t("table.window"),
      render: (row) => (
        <span className={cn(
          "inline-flex text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
          windowBadgeClass(row.whatsappWindowOpen),
        )}>
          {row.whatsappWindowOpen ? t("window.open") : t("window.closed")}
        </span>
      ),
    },
    {
      key: "lastActivity",
      header: t("table.lastActivity"),
      render: (row) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.lastActivityAt, locale)}</span>
      ),
    },
    {
      key: "createdAt",
      header: t("table.createdAt"),
      render: (row) => (
        <span className="text-sm text-foreground">{formatDate(row.createdAt, locale)}</span>
      ),
    },
  ], [t, locale])

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <DashboardPageHeader
          icon={<Users className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          description={t("header.description")}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <DashboardTable<LeadListItem>
          stats={[
            {
              label: t("summary.total"),
              value: loading ? "..." : String(totalItems),
              icon: <Users className="h-4 w-4 text-blue-500" weight="fill" />,
            },
            {
              label: t("summary.withWhatsApp"),
              value: loading ? "..." : String(summary.withWhatsApp),
              icon: <WhatsappLogo className="h-4 w-4 text-emerald-500" weight="fill" />,
            },
          ]}
          data={items}
          columns={columns}
          rowKey={(row) => row.id}
          loading={loading}
          toolbar={
            <div className="flex flex-col gap-3 w-full sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FunnelSimple className="h-5 w-5 text-muted-foreground" weight="bold" />
                <span className="text-sm font-medium text-foreground">{t("filters.label")}</span>
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-3 justify-end">
                <ElevatedSelect
                  value={whatsAppFilter}
                  onValueChange={(v) => { setWhatsAppFilter(v); setCurrentPage(1) }}
                  className="w-auto min-w-[140px]"
                >
                  <ElevatedSelectItem value="all">{t("filters.allWhatsApp")}</ElevatedSelectItem>
                  <ElevatedSelectItem value="true">{t("filters.hasWhatsApp")}</ElevatedSelectItem>
                  <ElevatedSelectItem value="false">{t("filters.noWhatsApp")}</ElevatedSelectItem>
                </ElevatedSelect>
              </div>
            </div>
          }
          pagination={
            totalPages > 1
              ? { currentPage, totalPages, pageSize: 20, totalItems, onPageChange: setCurrentPage }
              : undefined
          }
          paginationText={{ showing: "", of: "", items: t("records.total") }}
          emptyState={
            error
              ? { icon: <Users className="h-7 w-7 text-red-600" weight="fill" />, title: t("error.title"), description: error }
              : { icon: <Users className="h-7 w-7 text-slate-300" weight="fill" />, title: t("records.empty") }
          }
        />
      </motion.div>
    </motion.main>
  )
}

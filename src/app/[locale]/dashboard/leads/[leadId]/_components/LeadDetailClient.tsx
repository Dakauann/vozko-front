"use client"

import {
  ArrowLeft,
  Brain,
  Calendar,
  CalendarCheck,
  Clock,
  Hash,
  Phone,
  Users,
  WhatsappLogo,
} from "@/components/icons"
import LeadMemoriesSection from "@/components/crm/LeadMemoriesSection"
import { useWorkspace } from "@/contexts/workspace-context"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslations, useLocale } from "next-intl"
import Link from "next/link"
import { motion } from "framer-motion"
import type { LeadDetailResponse, CampaignHistoryItem } from "@/lib/leads/types"
import { cn } from "@/lib/utils"
import Button from "@/components/elevated-design/button"
import ElevatedContainer from "@/components/elevated-design/elevated-container"
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets"
import { getLeadCampaignHistoryAction } from "@/app/actions/leads"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
}

function fmt(value: string | undefined | null, locale: string): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode
  label: string
  value?: string | null
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className={cn("text-sm font-medium text-foreground", mono && "font-mono")}>
        {value ?? "—"}
      </span>
    </div>
  )
}

function channelBadge(type: string) {
  switch (type) {
    case "voice":
      return (
        <span className="inline-flex items-center gap-1 rounded-[--radius] bg-muted px-2 py-0.5 text-[11px] font-medium text-healthy-ink dark:text-healthy-ink">
          <Phone weight="fill" size={12} /> Voz
        </span>
      )
    case "whatsapp":
      return (
        <span className="inline-flex items-center gap-1 rounded-[--radius] bg-muted px-2 py-0.5 text-[11px] font-medium text-healthy-ink dark:text-healthy-ink">
          <WhatsappLogo weight="fill" size={12} /> WhatsApp
        </span>
      )
    default:
      return null
  }
}

function statusBadgeClass(status: string): string {
  const s = status.toUpperCase()
  if (["PENDING"].includes(s)) return "bg-muted text-warning-ink dark:text-warning-ink"
  if (["ONGOING", "RINGING"].includes(s)) return "bg-muted text-muted-foreground dark:bg-muted dark:text-info-ink"
  if (["RECEIVED", "DELIVERED", "SENT"].includes(s)) return "bg-muted text-healthy-ink dark:text-healthy-ink"
  if (["FAILED", "NOT_FOUND", "BUSY", "NO_ANSWER", "CANCELLED"].includes(s)) return "bg-muted text-destructive-ink dark:text-destructive-ink"
  if (["ENDED", "VOICEMAIL"].includes(s)) return "bg-slate-100 text-muted-foreground dark:bg-muted dark:text-muted-foreground"
  return "bg-slate-100 text-muted-foreground dark:bg-muted dark:text-muted-foreground"
}

function CampaignCard({ campaign, locale, t }: { campaign: CampaignHistoryItem; locale: string; t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-[--radius] border border-border bg-card p-4" style={{ boxShadow: softSurfaceShadow }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 text-left"
      >
        {channelBadge(campaign.type)}
        <span className="flex-1 text-sm font-medium">{campaign.campaignName || campaign.campaignId}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {campaign.entries.length} {t("campaignHistory.entries")}
        </span>
        <svg
          className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", expanded && "rotate-180")}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="mt-3 border-t pt-3">
            {campaign.entries.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">{t("records.empty")}</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="py-1.5 pr-3 text-left font-semibold">{t("campaignHistory.status")}</th>
                    <th className="py-1.5 px-3 text-left font-semibold">{t("campaignHistory.date")}</th>
                    <th className="py-1.5 pl-3 text-left font-semibold">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.entries.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-muted">
                      <td className="py-1.5 pr-3">
                        <span className={`inline-block rounded-[--radius] px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(entry.status)}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-muted-foreground">{fmt(entry.createdAt, locale)}</td>
                      <td className="py-1.5 pl-3 font-mono text-muted-foreground">{entry.id.slice(0, 8)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default function LeadDetailClient({
  leadId,
}: {
  leadId: string
}) {
  const t = useTranslations("leadsPage")
  const tMemories = useTranslations("leadMemories")
  const locale = useLocale()
  const { can } = useWorkspace()
  const canManageMemories = can("leads", "update")

  const [lead, setLead] = useState<LeadDetailResponse["data"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tRef = useRef(t)
  tRef.current = t

  const fetchLead = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { lead: data, error: err } = await getLeadCampaignHistoryAction(leadId)
      if (err) setError(err)
      else setLead(data)
    } catch {
      setError(tRef.current("error.title"))
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => { fetchLead() }, [fetchLead])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Clock weight="bold" className="h-8 w-8 animate-spin text-primary-ink" />
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <ElevatedContainer className="max-w-md p-8 text-center">
          <Users weight="fill" className="mx-auto mb-4 h-12 w-12 text-warning-ink" />
          <h2 className="text-xl font-semibold text-foreground">{t("error.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error || t("records.empty")}</p>
          <Button variant="outline" title="Voltar" link="/dashboard/leads" newTab={false} className="mt-4 text-[11px] font-semibold" />
        </ElevatedContainer>
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            title=""
            icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
            iconVisible
            iconSide="left"
            link="/dashboard/leads"
            newTab={false}
            className="text-xs font-semibold"
          />
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow-lg">
              <Users weight="fill" className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold text-primary-ink">
                {t("header.badge")}
              </p>
              <h1 className="text-2xl font-semibold text-foreground">
                {lead.name || lead.number}
              </h1>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Lead status banner */}
      <motion.div variants={itemVariants}>
        <div className="rounded-[--radius] border border-border bg-card p-5" style={{ boxShadow: softSurfaceShadow }}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-[--radius] bg-muted px-3 py-1.5 text-[11px] font-semibold text-healthy-ink dark:text-healthy-ink">
              <WhatsappLogo weight="fill" className="h-3.5 w-3.5" />
              {lead.whatsappWindowOpen ? t("window.open") : t("window.closed")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground dark:bg-muted dark:text-muted-foreground">
              <WhatsappLogo weight="fill" className="h-3.5 w-3.5" />
              {lead.whatsappCampaigns} whatsapp
            </span>
            {lead.lastActivityAt && (
              <span className="ml-auto text-xs font-mono text-muted-foreground">
                {t("table.lastActivity")}: {fmt(lead.lastActivityAt, locale)}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabbed content */}
      <motion.div variants={itemVariants}>
        <div className="rounded-[--radius] border border-border bg-card p-6" style={{ boxShadow: softSurfaceShadow }}>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto gap-1 p-1">
              <TabsTrigger value="overview" className="flex items-center gap-2 py-2">
                <Users weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">{t("header.badge")}</span>
              </TabsTrigger>
              <TabsTrigger value="memories" className="flex items-center gap-2 py-2">
                <Brain weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">{tMemories("title")}</span>
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="flex items-center gap-2 py-2">
                <Phone weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">{t("campaignHistory.title")}</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview tab */}
            <TabsContent value="overview" className="mt-6 space-y-4 focus-visible:outline-none">
              <div className="mb-2 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground">
                  <Phone weight="fill" className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{t("header.badge")}</h2>
                  <p className="text-sm text-muted-foreground">{t("header.description")}</p>
                </div>
              </div>

              <div>
                <InfoRow icon={<Hash weight="fill" className="h-4 w-4" />} label={t("table.number")} value={lead.number} mono />
                <InfoRow icon={<Users weight="fill" className="h-4 w-4" />} label={t("table.name")} value={lead.name} />
                <InfoRow icon={<Clock weight="fill" className="h-4 w-4" />} label={t("table.age")} value={lead.age != null ? `${lead.age} anos` : null} />
                <InfoRow icon={<Calendar weight="fill" className="h-4 w-4" />} label={t("table.createdAt")} value={fmt(lead.createdAt, locale)} />
                <InfoRow icon={<CalendarCheck weight="fill" className="h-4 w-4" />} label={t("table.lastActivity")} value={fmt(lead.lastActivityAt, locale)} />
                <InfoRow icon={<WhatsappLogo weight="fill" className="h-4 w-4" />} label={t("table.window")} value={lead.whatsappWindowOpen ? t("window.open") : t("window.closed")} />
              </div>
            </TabsContent>

            {/* Memories tab — same component the inbox context rail renders. */}
            <TabsContent value="memories" className="mt-6 focus-visible:outline-none">
              <div className="mb-2 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground">
                  <Brain weight="fill" className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tMemories("title")}</h2>
                  <p className="text-sm text-muted-foreground">{tMemories("subtitle")}</p>
                </div>
              </div>
              <LeadMemoriesSection leadId={leadId} canManage={canManageMemories} />
            </TabsContent>

            {/* Campaigns tab */}
            <TabsContent value="campaigns" className="mt-6 space-y-4 focus-visible:outline-none">
              <div className="mb-2 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-healthy text-healthy-foreground">
                  <Phone weight="fill" className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{t("campaignHistory.title")}</h2>
                  <p className="text-sm text-muted-foreground">{lead.whatsappCampaigns} {t("records.total")}</p>
                </div>
              </div>

              {lead.campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("campaignHistory.noCampaigns")}</p>
              ) : (
                <div className="space-y-3">
                  {lead.campaigns.map((campaign) => (
                    <CampaignCard key={`${campaign.type}:${campaign.campaignId}`} campaign={campaign} locale={locale} t={t} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </motion.div>
  )
}

"use client";

import {
  ArrowRight,
  ChartBar,
  ChatCircle,
  Clock,
  Phone,
  PlusCircle,
  Pulse,
  Robot,
  Users,
  Wallet,
  WhatsappLogo,
} from "@phosphor-icons/react";
import type {
  AttendantStats,
  WindowStats,
} from "@/lib/attendance/types";
import {
  getAttendanceStatsAction,
  getWindowStatsAction,
} from "@/app/actions/attendance";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import Link from "next/link";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";
import { listWhatsAppCampaignsAction } from "@/app/actions/whatsapp-campaigns";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
    },
  },
};


const STATUS_COLORS: Record<string, string> = {
  RUNNING: "bg-emerald-500 text-white",
  PAUSED: "bg-amber-500 text-white",
  STOPPED: "bg-slate-500 text-white",
  COMPLETED: "bg-primary text-primary-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  RUNNING: "Em execução",
  PAUSED: "Pausada",
  STOPPED: "Parada",
  COMPLETED: "Concluída",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}


function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-border bg-muted/50 p-4"
        >
          <div className="h-4 bg-border rounded w-1/2 mb-2" />
          <div className="h-3 bg-border rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

function DashboardSectionHeader({
  icon,
  iconBgClass,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  iconBgClass: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white",
            iconBgClass,
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

type QuickActionItem = {
  title: string;
  description: string;
  icon: typeof WhatsappLogo;
  href: string;
  bgClass: string;
};

function QuickActionCard({ action }: { action: QuickActionItem }) {
  const Icon = action.icon;

  return (
    <Link
      href={action.href}
      className="block rounded-2xl border border-border/70 bg-background/70 px-4 py-4 text-left transition-all hover:border-primary/30 hover:bg-background"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white",
              action.bgClass,
            )}
          >
            <Icon className="h-4 w-4" weight="fill" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {action.title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {action.description}
            </p>
          </div>
        </div>
        <ArrowRight
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          weight="bold"
        />
      </div>
    </Link>
  );
}

function RecentActivityCard({
  href,
  icon,
  iconBgClass,
  title,
  description,
  status,
  metrics,
}: {
  href: string;
  icon: ReactNode;
  iconBgClass: string;
  title: string;
  description: string;
  status: string;
  metrics: Array<{ label: string; value: string }>;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-border/70 bg-background/70 px-4 py-4 text-left transition-all hover:border-primary/30 hover:bg-background"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white",
              iconBgClass,
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        {metrics.map((metric) => (
          <div
            key={`${title}-${metric.label}`}
            className="rounded-2xl border border-border/70 bg-card/80 px-3 py-3"
          >
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-2 font-semibold text-foreground">{metric.value}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}


function UserDashboard() {
  const t = useTranslations("dashboard");
  const { currentWorkspace, can, canAny, permissionsLoading } = useWorkspace();

  const [waCampaigns, setWaCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [attendants, setAttendants] = useState<AttendantStats[]>([]);
  const [windowStats, setWindowStats] = useState<WindowStats | null>(null);
  const [loading, setLoading] = useState(true);

  const canReadWaCampaigns =
    !permissionsLoading && canAny("whatsapp_campaigns");
  const canReadMembers = !permissionsLoading && can("members", "read");
  const canReadConversations = !permissionsLoading && canAny("conversations");
  const canReadPlans = !permissionsLoading && canAny("balance");

  useEffect(() => {
    if (permissionsLoading) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const promises: Promise<void>[] = [];

      if (canReadWaCampaigns) {
        promises.push(
          listWhatsAppCampaignsAction(1, 500, "desc").then((r) => {
            if (!cancelled) setWaCampaigns(r.campaigns ?? []);
          }),
        );
      }
      if (canReadMembers) {
        promises.push(
          Promise.all([
            getAttendanceStatsAction(),
            getWindowStatsAction(),
          ]).then(([statsR, winR]) => {
            if (cancelled) return;
            setAttendants(statsR.attendants ?? []);
            setWindowStats(winR.stats ?? null);
          }),
        );
      }

      await Promise.allSettled(promises);
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [
    permissionsLoading,
    canReadWaCampaigns,
    canReadMembers,
  ]);

  const runningWa = useMemo(
    () => waCampaigns.filter((c) => c.status === "RUNNING"),
    [waCampaigns],
  );
  const recentWa = useMemo(() => waCampaigns.slice(0, 5), [waCampaigns]);

  const aggregateRate = useMemo(() => {
    if (attendants.length === 0) return 0;
    const assigned = attendants.reduce((s, a) => s + a.assigned_count, 0);
    const responded = attendants.reduce((s, a) => s + a.responded_count, 0);
    if (assigned === 0) return 0;
    return Math.round((responded / assigned) * 100);
  }, [attendants]);

  const avgResponseTime = useMemo(() => {
    const valid = attendants.filter((a) => a.avg_response_time_mins > 0);
    if (valid.length === 0) return 0;
    return (
      Math.round(
        (valid.reduce((s, a) => s + a.avg_response_time_mins, 0) /
          valid.length) *
          10,
      ) / 10
    );
  }, [attendants]);

  const totalOpenWindows = windowStats?.total_open ?? 0;
  const enabledModuleCount = [
    canReadWaCampaigns,
    canReadMembers,
    canReadConversations,
  ].filter(Boolean).length;

  const overviewStats = (() => {
    const stats: Array<{
      label: string;
      value: string;
      helper: string;
      icon: typeof WhatsappLogo;
      bg: string;
    }> = [];

    if (canReadWaCampaigns) {
      stats.push({
        label: t("whatsappCampaigns"),
        value: String(waCampaigns.length),
        helper:
          runningWa.length > 0
            ? runningWa.length === 1 ? t("activeCount", { count: runningWa.length }) : t("activeCountPlural", { count: runningWa.length })
            : t("noActiveNow"),
        icon: WhatsappLogo,
        bg: "bg-emerald-500",
      });
    }

    if (canReadMembers) {
      stats.push({
        label: t("responseRate"),
        value: `${aggregateRate}%`,
        helper:
          avgResponseTime > 0
            ? t("avgResponseTime", { minutes: avgResponseTime })
            : t("noConsolidatedAvg"),
        icon: Pulse,
        bg: "bg-blue-500",
      });
      stats.push({
        label: t("openWindows"),
        value: String(totalOpenWindows),
        helper: t("ongoingConversations"),
        icon: Clock,
        bg: "bg-amber-500",
      });
    }

    return stats;
  })();

  const quickActions = useMemo(() => {
    const actions: QuickActionItem[] = [];

    if (canReadConversations) {
      actions.push({
        title: "Chat ao vivo",
        description: "Conversas em tempo real",
        icon: ChatCircle,
        href: "/dashboard/live-chat",
        bgClass: "bg-blue-500",
      });
    }
    if (can("whatsapp_campaigns", "create")) {
      actions.push({
        title: "Nova campanha WhatsApp",
        description: "Envie mensagens em massa",
        icon: WhatsappLogo,
        href: "/dashboard/whatsapp-campaigns/new",
        bgClass: "bg-emerald-500",
      });
    }
    if (can("agents", "create")) {
      actions.push({
        title: t("createAgent"),
        description: t("createAgentDescription"),
        icon: Robot,
        href: "/dashboard/agents/new",
        bgClass: "bg-amber-500",
      });
    }
    return actions;
  }, [canReadConversations, can]);

  const formatDate = (s: string) => {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
      }).format(new Date(s));
    } catch {
      return "-";
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="flex flex-col gap-1">
        <div
          className="rounded-[26px] border border-border/70 bg-card/90 p-5 md:p-6"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <DashboardPageHeader
            actions={
              <>
                {canReadPlans ? (
                  <Button
                    icon={<Wallet className="h-4 w-4" weight="fill" />}
                    iconVisible
                    link="/dashboard/plans"
                    newTab={false}
                    title="Ver planos"
                    variant="outline"
                  />
                ) : null}
                {canReadConversations ? (
                  <Button
                    icon={<ChatCircle className="h-4 w-4" weight="fill" />}
                    iconVisible
                    link="/dashboard/live-chat"
                    newTab={false}
                    title="Abrir atendimento"
                  />
                ) : null}
              </>
            }
            badge={currentWorkspace ? "Visão da área de trabalho" : "Dashboard"}
            description={
              currentWorkspace
                ? `Acompanhe campanhas, atendimento e saldo da área de trabalho ${currentWorkspace.name} em um único painel.`
                : t("pageSubtitle")
            }
            icon={<ChartBar className="h-6 w-6" weight="fill" />}
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase text-primary">
                Área de Trabalho atual
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {currentWorkspace?.name ?? t("noWorkspaceSelected")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentWorkspace
                  ? `${enabledModuleCount} modulo${enabledModuleCount === 1 ? "" : "s"} com visibilidade nesta area.`
                  : "Selecione uma área de trabalho para destravar campanhas, atendimento e métricas."}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Campanhas ativas
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {runningWa.length}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Acoes rapidas
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {quickActions.length}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Conversas abertas
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {canReadMembers ? totalOpenWindows : "--"}
              </p>
            </div>
          </div>

          {overviewStats.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {overviewStats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-border/70 bg-background/60 p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="mt-2 truncate text-2xl font-semibold text-foreground">
                          {stat.value}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {stat.helper}
                        </p>
                      </div>
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${stat.bg}`}
                      >
                        <Icon className="h-4 w-4 text-white" weight="fill" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </motion.div>

      {(quickActions.length > 0 || canReadWaCampaigns) && (
        <motion.div variants={itemVariants}>
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section
              className="space-y-4 rounded-[26px] border border-border/70 bg-card/90 p-5"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <DashboardSectionHeader
                icon={<PlusCircle className="h-4 w-4" weight="fill" />}
                iconBgClass="bg-slate-700"
                title={t("quickActions.sectionTitle")}
                description="Acessos diretos para as tarefas mais usadas da área de trabalho."
              />

              {quickActions.length > 0 ? (
                <div className="space-y-3">
                  {quickActions.map((action) => (
                    <QuickActionCard key={action.href} action={action} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-4 py-10 text-center">
                  <PlusCircle
                    className="mx-auto h-8 w-8 text-muted-foreground"
                    weight="fill"
                  />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {t("noQuickActions")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    As ações aparecem de acordo com as permissões da área de
                    trabalho.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                <p className="text-[11px] font-semibold uppercase text-primary">
                  Planos
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  Gerencie seus planos
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Faça upgrades, contrate novos recursos e aproveite mais
                  funcionalidades para o seu negócio.
                </p>
                {canReadPlans ? (
                  <div className="mt-4">
                    <Button
                      icon={<Wallet className="h-4 w-4" weight="fill" />}
                      iconVisible
                      link="/dashboard/plans"
                      newTab={false}
                      title="Ver planos"
                    />
                  </div>
                ) : null}
              </div>
            </section>

            <section
              className="space-y-4 rounded-[26px] border border-border/70 bg-card/90 p-5"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <DashboardSectionHeader
                icon={<ChartBar className="h-4 w-4" weight="fill" />}
                iconBgClass="bg-primary"
                title="Atividade recente"
                description="Os módulos principais da área de trabalho seguem a mesma lógica de cards do catálogo de planos."
              />

              <div className="grid gap-4 md:grid-cols-2">
                {canReadWaCampaigns ? (
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                    <DashboardSectionHeader
                      action={
                        <Link
                          href="/dashboard/whatsapp-campaigns"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Ver todas
                        </Link>
                      }
                      description="Templates, volume e status das últimas campanhas."
                      icon={<WhatsappLogo className="h-4 w-4" weight="fill" />}
                      iconBgClass="bg-emerald-500"
                      title="Campanhas WhatsApp"
                    />

                    {loading ? (
                      <CardSkeleton rows={3} />
                    ) : recentWa.length > 0 ? (
                      <div className="space-y-3">
                        {recentWa.map((c) => (
                          <RecentActivityCard
                            key={c.id}
                            description={
                              c.templateName ?? "Template sem nome vinculado"
                            }
                            href={`/dashboard/whatsapp-campaigns/${c.id}`}
                            icon={
                              <WhatsappLogo className="h-4 w-4" weight="fill" />
                            }
                            iconBgClass="bg-emerald-500"
                            metrics={[
                              {
                                label: "Contatos",
                                value: `${c.metrics?.totalNumbers ?? 0}`,
                              },
                              {
                                label: "Criada em",
                                value: formatDate(c.createdAt),
                              },
                            ]}
                            status={c.status}
                            title={c.name}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-card/80 px-4 py-10 text-center">
                        <WhatsappLogo
                          className="mx-auto h-8 w-8 text-muted-foreground"
                          weight="fill"
                        />
                        <p className="mt-3 text-sm font-medium text-foreground">
                          {t("noCampaignsYet")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Crie sua primeira campanha para popular esta área.
                        </p>
                        {can("whatsapp_campaigns", "create") ? (
                          <Link
                            href="/dashboard/whatsapp-campaigns/new"
                            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            Criar campanha
                            <ArrowRight className="h-3 w-3" weight="bold" />
                          </Link>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}

              </div>
            </section>
          </div>
        </motion.div>
      )}

      {/* ── No workspace fallback (original) ──────────────────────────── */}
      {!currentWorkspace && !permissionsLoading && (
        <motion.div variants={itemVariants}>
          <ElevatedContainer
            className="border border-border/70 bg-gradient-to-br from-primary/5 to-primary/10 p-8 text-center"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <Users
              className="h-12 w-12 text-blue-300 mx-auto mb-3"
              weight="duotone"
            />
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {t("noWorkspaceSelected")}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Selecione uma área de trabalho para ver campanhas, conversas e
              métricas.
            </p>
          </ElevatedContainer>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  // Root dashboard is always the standard workspace overview for every role,
  // including platform admins. Admin financial view lives at /dashboard/admin.
  return <UserDashboard />;
}

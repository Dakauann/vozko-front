"use client";

import {
  Brain,
  ChartPie,
  ChatCircle,
  Fire,
  Smiley,
  SmileyMeh,
  SmileySad,
  Target,
  TrendUp,
  Warning,
} from "@phosphor-icons/react";

import type { AnalysisStats } from "@/lib/analysis/types";
import { IconBox } from "@/components/elevated-design/listing-card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useTranslations } from "next-intl";

interface AnalysisStatsPanelProps {
  stats: AnalysisStats | null;
  loading: boolean;
  error: string | null;
  translationNamespace: "campaignsPage" | "whatsappCampaignsPage";
  compact?: boolean;
}

function StatCard({
  title,
  value,
  icon,
  color,
  delay = 0,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/70"
      style={{ boxShadow: softSurfaceShadow }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}15` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </motion.div>
  );
}

function ProgressBar({
  label,
  value,
  total,
  color,
  delay = 0,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  delay?: number;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="space-y-1"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">
          {value}{" "}
          <span className="text-muted-foreground">
            ({percentage.toFixed(1)}%)
          </span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, delay: delay + 0.1 }}
        />
      </div>
    </motion.div>
  );
}

function SentimentBadge({
  type,
  value,
  total,
  delay = 0,
}: {
  type: "positive" | "neutral" | "negative";
  value: number;
  total: number;
  delay?: number;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  const config = {
    positive: {
      icon: <Smiley weight="fill" className="h-5 w-5" />,
      color: "#22c55e",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
    },
    neutral: {
      icon: <SmileyMeh weight="fill" className="h-5 w-5" />,
      color: "#6b7280",
      bgColor: "bg-muted",
      borderColor: "border-border",
    },
    negative: {
      icon: <SmileySad weight="fill" className="h-5 w-5" />,
      color: "#ef4444",
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/30",
    },
  };

  const { icon, color, bgColor, borderColor } = config[type];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-xl border",
        bgColor,
        borderColor,
      )}
    >
      <span style={{ color }}>{icon}</span>
      <div className="text-center">
        <p className="text-lg font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">
          {percentage.toFixed(1)}%
        </p>
      </div>
    </motion.div>
  );
}

export default function AnalysisStatsPanel({
  stats,
  loading,
  error,
  translationNamespace,
  compact = false,
}: AnalysisStatsPanelProps) {
  const t = useTranslations(`${translationNamespace}.analysis`);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="h-full"
      >
        <div
          className={cn(
            "rounded-[26px] border border-border/70 bg-card/90 h-full",
            compact ? "p-5" : "p-8",
          )}
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div
            className={cn("flex items-center gap-3", compact ? "mb-4" : "mb-6")}
          >
            <IconBox color="violet" size="sm">
              <Brain weight="bold" />
            </IconBox>
            <div>
              <h2
                className={cn(
                  "font-semibold text-foreground",
                  compact ? "text-base" : "text-lg",
                )}
              >
                {t("title")}
              </h2>
              {!compact && (
                <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
              )}
            </div>
          </div>
          <div
            className={cn(
              "flex items-center justify-center",
              compact ? "py-6" : "py-12",
            )}
          >
            <div className="flex items-center gap-3 text-muted-foreground">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Brain
                  weight="bold"
                  className={compact ? "h-5 w-5" : "h-6 w-6"}
                />
              </motion.div>
              <span className={compact ? "text-sm" : ""}>{t("loading")}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="h-full"
      >
        <div
          className={cn(
            "rounded-[26px] border border-rose-200/70 bg-rose-50/50 h-full",
            compact ? "p-5" : "p-8",
          )}
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="flex items-center gap-3 text-rose-600">
            <Warning
              weight="fill"
              className={compact ? "h-4 w-4" : "h-5 w-5"}
            />
            <span className={compact ? "text-sm" : ""}>
              {t("error")}: {error}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!stats || stats.totalAnalyses === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="h-full"
      >
        <div
          className={cn(
            "rounded-[26px] border border-border/70 bg-card/90 h-full",
            compact ? "p-5" : "p-8",
          )}
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div
            className={cn("flex items-center gap-3", compact ? "mb-4" : "mb-6")}
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-xl bg-violet-500 text-white",
                compact ? "h-8 w-8" : "h-10 w-10",
              )}
            >
              <Brain
                weight="bold"
                className={compact ? "h-4 w-4" : "h-5 w-5"}
              />
            </div>
            <div>
              <h2
                className={cn(
                  "font-semibold text-foreground",
                  compact ? "text-base" : "text-lg",
                )}
              >
                {t("title")}
              </h2>
              {!compact && (
                <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
              )}
            </div>
          </div>
          <div
            className={cn(
              "flex flex-col items-center justify-center text-muted-foreground",
              compact ? "py-6" : "py-12",
            )}
          >
            <ChartPie className={compact ? "h-8 w-8 mb-2" : "h-12 w-12 mb-3"} />
            <p className={cn(compact ? "text-xs" : "text-sm")}>{t("noData")}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  const totalSentiment =
    stats.sentimentPositive + stats.sentimentNeutral + stats.sentimentNegative;
  const totalQualification =
    stats.qualificationHotLead +
    stats.qualificationWarmLead +
    stats.qualificationColdLead;
  const totalInterest =
    stats.interestInterested +
    stats.interestNotInterested +
    stats.interestUndecided;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="h-full"
      >
        <div
          className="rounded-[26px] border border-border/70 bg-card/90 p-5 h-full"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 text-white">
                <Brain weight="bold" className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                {t("title")}
              </h2>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-violet-500 px-2.5 py-1 text-[11px] font-semibold text-white">
              <Brain weight="fill" className="h-3.5 w-3.5" />
              {stats.totalAnalyses}
            </span>
          </div>

          {/* Compact Summary Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted border border-border">
              <TrendUp weight="fill" className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {t("avgQuality")}
                </p>
                <p className="text-sm font-bold text-foreground">
                  {stats.avgAttendanceQuality.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted border border-border">
              <ChatCircle weight="fill" className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {t("totalMessages")}
                </p>
                <p className="text-sm font-bold text-foreground">
                  {stats.totalMessages.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Compact Sentiment Row */}
          <div className="mb-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
              {t("sentiment.title")}
            </p>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-1.5 p-2 rounded-lg bg-green-500/10 border border-green-500/15">
                <Smiley weight="fill" className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs font-semibold text-green-700">
                  {stats.sentimentPositive}
                </span>
              </div>
              <div className="flex-1 flex items-center gap-1.5 p-2 rounded-lg bg-muted border border-border">
                <SmileyMeh
                  weight="fill"
                  className="h-3.5 w-3.5 text-muted-foreground"
                />
                <span className="text-xs font-semibold text-muted-foreground">
                  {stats.sentimentNeutral}
                </span>
              </div>
              <div className="flex-1 flex items-center gap-1.5 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                <SmileySad weight="fill" className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs font-semibold text-red-700">
                  {stats.sentimentNegative}
                </span>
              </div>
            </div>
          </div>

          {/* Compact Lead Qualification */}
          <div className="mb-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
              {t("qualification.title")}
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground flex-1">
                  {t("qualification.hotLead")}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {stats.qualificationHotLead}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs text-muted-foreground flex-1">
                  {t("qualification.warmLead")}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {stats.qualificationWarmLead}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-xs text-muted-foreground flex-1">
                  {t("qualification.coldLead")}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {stats.qualificationColdLead}
                </span>
              </div>
            </div>
          </div>

          {/* Compact Interest */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
              {t("interest.title")}
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground flex-1">
                  {t("interest.interested")}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {stats.interestInterested}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs text-muted-foreground flex-1">
                  {t("interest.undecided")}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {stats.interestUndecided}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground flex-1">
                  {t("interest.notInterested")}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {stats.interestNotInterested}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="rounded-[26px] border border-border/70 bg-card/90 p-8"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-white">
              <Brain weight="bold" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t("title")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>
          </div>
          <span className="flex items-center gap-2 rounded-full bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white">
            <Brain weight="fill" className="h-4 w-4" />
            {stats.totalAnalyses} {t("totalAnalyses").toLowerCase()}
          </span>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title={t("totalAnalyses")}
            value={stats.totalAnalyses}
            icon={<Brain weight="fill" className="h-5 w-5" />}
            color="#8b5cf6"
            delay={0}
          />
          <StatCard
            title={t("avgQuality")}
            value={`${stats.avgAttendanceQuality.toFixed(1)}%`}
            icon={<TrendUp weight="fill" className="h-5 w-5" />}
            color="#22c55e"
            delay={0.1}
          />
          <StatCard
            title={t("totalMessages")}
            value={stats.totalMessages.toLocaleString()}
            icon={<ChatCircle weight="fill" className="h-5 w-5" />}
            color="#3b82f6"
            delay={0.2}
          />
          <StatCard
            title={t("avgMessages")}
            value={stats.avgMessagesPerAnalysis.toFixed(1)}
            icon={<ChatCircle weight="bold" className="h-5 w-5" />}
            color="#6366f1"
            delay={0.3}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sentiment Analysis */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Smiley weight="bold" className="h-4 w-4" />
              {t("sentiment.title")}
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <SentimentBadge
                type="positive"
                value={stats.sentimentPositive}
                total={totalSentiment}
                delay={0}
              />
              <SentimentBadge
                type="neutral"
                value={stats.sentimentNeutral}
                total={totalSentiment}
                delay={0.1}
              />
              <SentimentBadge
                type="negative"
                value={stats.sentimentNegative}
                total={totalSentiment}
                delay={0.2}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("sentiment.positive")}</span>
              <span>{t("sentiment.neutral")}</span>
              <span>{t("sentiment.negative")}</span>
            </div>
          </div>

          {/* Lead Qualification */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Fire weight="bold" className="h-4 w-4" />
              {t("qualification.title")}
            </h3>
            <div className="space-y-3">
              <ProgressBar
                label={t("qualification.hotLead")}
                value={stats.qualificationHotLead}
                total={totalQualification}
                color="#ef4444"
                delay={0}
              />
              <ProgressBar
                label={t("qualification.warmLead")}
                value={stats.qualificationWarmLead}
                total={totalQualification}
                color="#f59e0b"
                delay={0.1}
              />
              <ProgressBar
                label={t("qualification.coldLead")}
                value={stats.qualificationColdLead}
                total={totalQualification}
                color="#6b7280"
                delay={0.2}
              />
            </div>
          </div>

          {/* Interest Level */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target weight="bold" className="h-4 w-4" />
              {t("interest.title")}
            </h3>
            <div className="space-y-3">
              <ProgressBar
                label={t("interest.interested")}
                value={stats.interestInterested}
                total={totalInterest}
                color="#22c55e"
                delay={0}
              />
              <ProgressBar
                label={t("interest.undecided")}
                value={stats.interestUndecided}
                total={totalInterest}
                color="#eab308"
                delay={0.1}
              />
              <ProgressBar
                label={t("interest.notInterested")}
                value={stats.interestNotInterested}
                total={totalInterest}
                color="#ef4444"
                delay={0.2}
              />
            </div>
          </div>

          {/* Attendance Quality */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendUp weight="bold" className="h-4 w-4" />
              {t("quality.title")}
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-muted border border-border text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {t("quality.min")}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {stats.minAttendanceQuality}%
                </p>
              </div>
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-xs text-green-600 mb-1">
                  {t("quality.avg")}
                </p>
                <p className="text-xl font-bold text-green-700">
                  {stats.avgAttendanceQuality.toFixed(1)}%
                </p>
              </div>
              <div className="p-4 rounded-xl bg-muted border border-border text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {t("quality.max")}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {stats.maxAttendanceQuality}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  getCommentAnalysisSettingsAction,
  getCommentAnalysisStatsAction,
  getCommentAnalysisTrendsAction,
} from "@/app/actions/comment-analysis";
import type { CommentAnalysisSettings, CommentAnalysisStats, TrendPoint } from "@/lib/comment-analysis/types";
import { useWorkspace } from "@/contexts/workspace-context";
import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { CommentAnalysisOverview } from "@/components/instagram/comment-analysis-overview";
import { CommentAnalysisTopics } from "@/components/instagram/comment-analysis-topics";
import { CommentAnalysisAuthors } from "@/components/instagram/comment-analysis-authors";
import { CommentAnalysisFeed } from "@/components/instagram/comment-analysis-feed";
import { CommentAnalysisSettingsPanel } from "@/components/instagram/comment-analysis-settings";
import { EmptyState, Skeleton } from "@/components/instagram/comment-analysis-shared";
import { ChartLineUp, ChatCircle, Gear, Hash, ShieldWarning, Sparkle, Warning } from "@/components/icons";

/*
 * The "Audiência" tab of an Instagram account: the five panels of plan §13
 * behind one sub-navigation, with the settings the engine reads loaded once
 * and shared (the topic set names every chip on the page).
 *
 * Off by default. An account whose analysis is switched off sees one thing
 * here: what the feature does and the switch to turn it on, gated on the
 * update permission because turning it on starts billing.
 */

type Section = "overview" | "topics" | "authors" | "feed" | "settings";

const TREND_DAYS = 30;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function CommentAnalysisTab({ accountId }: { accountId: string }) {
  const t = useTranslations("commentAnalysis");
  const { can } = useWorkspace();
  const canConfigure = can("comment_analysis", "update");

  const [section, setSection] = useState<Section>("overview");
  const [settings, setSettings] = useState<CommentAnalysisSettings | null>(null);
  const [stats, setStats] = useState<CommentAnalysisStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusTopics, setFocusTopics] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCommentAnalysisSettingsAction("instagram", accountId).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setSettings(result.settings ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  // refreshKey bumps after a settings save so the numbers reload without
  // the effect calling anything that sets state synchronously.
  const [refreshKey, setRefreshKey] = useState(0);
  const enabled = settings?.enabled ?? false;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void Promise.all([
      getCommentAnalysisStatsAction({ accountId }),
      getCommentAnalysisTrendsAction("account", accountId, isoDaysAgo(TREND_DAYS)),
    ]).then(([statsResult, trendResult]) => {
      if (cancelled) return;
      if (statsResult.error) setError(statsResult.error);
      else setStats(statsResult.stats ?? null);
      if (!trendResult.error) setTrend(trendResult.points);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, enabled, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <EmptyState icon={<Warning weight="duotone" />} title={t("errorTitle")} description={error} />
    );
  }

  if (!settings) return null;

  if (!settings.enabled && section !== "settings") {
    return (
      <div className="rounded-[--radius] border border-border bg-card">
        <EmptyState
          icon={<Sparkle weight="duotone" />}
          title={t("disabled.title")}
          description={t("disabled.description")}
          action={
            canConfigure ? (
              <Button className="mt-2" variant="primary" title={t("disabled.cta")} icon={<Gear className="h-4 w-4" weight="fill" />} onClick={() => setSection("settings")} />
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t("disabled.noPermission")}</p>
            )
          }
        />
      </div>
    );
  }

  const options = [
    { value: "overview" as const, label: t("sections.overview"), icon: <ChartLineUp className="h-3.5 w-3.5" weight="fill" /> },
    { value: "topics" as const, label: t("sections.topics"), icon: <Hash className="h-3.5 w-3.5" weight="fill" /> },
    { value: "authors" as const, label: t("sections.authors"), icon: <ShieldWarning className="h-3.5 w-3.5" weight="fill" /> },
    { value: "feed" as const, label: t("sections.feed"), icon: <ChatCircle className="h-3.5 w-3.5" weight="fill" /> },
    ...(canConfigure ? [{ value: "settings" as const, label: t("sections.settings"), icon: <Gear className="h-3.5 w-3.5" weight="fill" /> }] : []),
  ];

  return (
    <div className="space-y-4">
      <ElevatedPillToggle<Section>
        aria-label={t("sectionsLabel")}
        value={section}
        onChange={(s) => {
          setSection(s);
          if (s !== "settings") setFocusTopics(false);
        }}
        options={options}
        collapseLabels="sm"
      />

      {section === "overview" ? <CommentAnalysisOverview stats={stats} trend={trend} loading={!stats} /> : null}
      {section === "topics" ? (
        <CommentAnalysisTopics
          topics={settings.topics}
          stats={stats?.topics ?? []}
          onEditTopics={
            canConfigure
              ? () => {
                  setFocusTopics(true);
                  setSection("settings");
                }
              : undefined
          }
        />
      ) : null}
      {section === "authors" ? <CommentAnalysisAuthors accountId={accountId} topics={settings.topics} /> : null}
      {section === "feed" ? <CommentAnalysisFeed accountId={accountId} topics={settings.topics} /> : null}
      {section === "settings" && canConfigure ? (
        <CommentAnalysisSettingsPanel
          settings={settings}
          focusTopics={focusTopics}
          onUpdated={(next) => {
            setSettings(next);
            if (next.enabled) setRefreshKey((k) => k + 1);
          }}
        />
      ) : null}
    </div>
  );
}

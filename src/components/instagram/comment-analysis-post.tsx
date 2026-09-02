"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  deleteCommentContainerSettingsAction,
  getCommentAnalysisStatsAction,
  getCommentAnalysisTrendsAction,
  getCommentContainerSettingsAction,
  putCommentContainerSettingsAction,
} from "@/app/actions/comment-analysis";
import type { CommentAnalysisStats, CommentContainerSettings, CommentSource, TrendPoint } from "@/lib/comment-analysis/types";
import type { OverrideDraft } from "@/lib/comment-analysis/override";
import { overrideDraftFrom, overrideDraftToPut } from "@/lib/comment-analysis/override";
import { useWorkspace } from "@/contexts/workspace-context";
import { Link } from "@/i18n/routing";
import Button from "@/components/elevated-design/button";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { CommentAnalysisOverview } from "@/components/instagram/comment-analysis-overview";
import { CommentAnalysisFeed } from "@/components/instagram/comment-analysis-feed";
import { OverrideFields } from "@/components/instagram/comment-analysis-override-fields";
import { Chip, EmptyState, Panel, Skeleton } from "@/components/instagram/comment-analysis-shared";
import { ArrowSquareOut, ChartLineUp, ChatCircle, Gear, Sparkle, Warning } from "@/components/icons";

/*
 * A post's analysis, inside the post detail dialog: what the engine sees for
 * THIS post (the account's settings with the post's own layered on), the
 * post's numbers through the same overview and feed the account tab uses,
 * scoped to the post, and the override editor.
 *
 * The fallback is the back-end's (post override, then account, then off);
 * this panel only shows the two tiers side by side and edits the top one. A
 * field left blank inherits, and an override with every field blank is not
 * stored at all, so "inherit everything" and "no override" are one state.
 * The draft mappings live in lib/comment-analysis/override.ts, tested there.
 */

const SOURCE: CommentSource = "instagram";
const TREND_DAYS = 30;

type Section = "overview" | "feed" | "settings";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function CommentPostAnalysisPanel({ accountId, containerId }: { accountId: string; containerId: string }) {
  const t = useTranslations("commentAnalysis.post");
  const tc = useTranslations("commentAnalysis");
  const { can } = useWorkspace();
  const canConfigure = can("comment_analysis", "update");

  const [section, setSection] = useState<Section>("overview");
  const [settings, setSettings] = useState<CommentContainerSettings | null>(null);
  const [stats, setStats] = useState<CommentAnalysisStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCommentContainerSettingsAction(SOURCE, accountId, containerId).then((s) => {
      if (cancelled) return;
      if (s.error) setError(s.error);
      else setSettings(s.settings ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, containerId]);

  // The numbers, scoped to the post: the same stats and rollup series the
  // account tab shows, so a figure here and there cannot disagree.
  const enabled = settings?.effective.enabled ?? false;
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void Promise.all([
      getCommentAnalysisStatsAction({ accountId, containerId }),
      getCommentAnalysisTrendsAction("container", containerId, isoDaysAgo(TREND_DAYS)),
    ]).then(([st, tr]) => {
      if (cancelled) return;
      if (!st.error) setStats(st.stats ?? null);
      if (!tr.error) setTrend(tr.points);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, containerId, enabled]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (error || !settings) {
    return <EmptyState icon={<Warning weight="duotone" />} title={t("errorTitle")} description={error ?? undefined} />;
  }

  const effective = settings.effective;
  const hasOverride = !!settings.override;
  const audienceHref = { pathname: "/dashboard/audience", query: { accountId, containerId } } as const;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Chip className={effective.enabled ? "text-healthy-ink" : "text-muted-foreground"}>
          {effective.enabled ? t("state.on") : t("state.off")}
        </Chip>
        <Chip>{hasOverride ? t("state.own") : t("state.inherited")}</Chip>
        <span className="text-muted-foreground">{t("state.threshold", { value: effective.severityThreshold })}</span>
        <Link href={audienceHref} className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
          {t("openAudience")} <ArrowSquareOut className="h-3.5 w-3.5" />
        </Link>
      </div>

      {effective.enabled ? (
        <ElevatedPillToggle<Section>
          aria-label={tc("sectionsLabel")}
          value={section}
          onChange={setSection}
          collapseLabels="sm"
          options={[
            { value: "overview", label: tc("sections.overview"), icon: <ChartLineUp className="h-3.5 w-3.5" weight="fill" /> },
            { value: "feed", label: tc("sections.feed"), icon: <ChatCircle className="h-3.5 w-3.5" weight="fill" /> },
            ...(canConfigure ? [{ value: "settings" as const, label: tc("sections.settings"), icon: <Gear className="h-3.5 w-3.5" weight="fill" /> }] : []),
          ]}
        />
      ) : null}

      {/* The dialog column is narrow on every viewport, so the overview
          takes its single-column layout regardless of the window width. */}
      {effective.enabled && section === "overview" ? <CommentAnalysisOverview stats={stats} trend={trend} loading={!stats} layout="narrow" /> : null}
      {effective.enabled && section === "feed" ? <CommentAnalysisFeed accountId={accountId} containerId={containerId} topics={effective.topics} /> : null}

      {!effective.enabled ? (
        <EmptyState icon={<Sparkle weight="duotone" />} title={t("offTitle")} description={canConfigure ? t("offHintConfigure") : t("offHint")} />
      ) : null}

      {/* The editor is always reachable while the post is off (it is how it
          gets switched on) and sits behind the settings pill while on. */}
      {canConfigure && (!effective.enabled || section === "settings") ? (
        <OverrideEditor accountId={accountId} containerId={containerId} settings={settings} onSaved={setSettings} />
      ) : null}
    </div>
  );
}

function OverrideEditor({
  accountId,
  containerId,
  settings,
  onSaved,
}: {
  accountId: string;
  containerId: string;
  settings: CommentContainerSettings;
  onSaved: (next: CommentContainerSettings) => void;
}) {
  const t = useTranslations("commentAnalysis.post.override");
  const [draft, setDraft] = useState<OverrideDraft>(() => overrideDraftFrom(settings));
  const [editing, setEditing] = useState(!!settings.override);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drafts follow a freshly saved object (adjust-state-during-render).
  const [seen, setSeen] = useState(settings);
  if (seen !== settings) {
    setSeen(settings);
    setDraft(overrideDraftFrom(settings));
    setEditing(!!settings.override);
  }

  const save = async () => {
    setSaving(true);
    const result = await putCommentContainerSettingsAction(SOURCE, accountId, containerId, overrideDraftToPut(draft));
    setSaving(false);
    if (result.error || !result.settings) {
      setError(result.error ?? t("saveFailed"));
      return;
    }
    setError(null);
    onSaved(result.settings);
  };

  const reset = async () => {
    if (!settings.override) {
      setEditing(false);
      setDraft(overrideDraftFrom(settings));
      return;
    }
    setSaving(true);
    const result = await deleteCommentContainerSettingsAction(SOURCE, accountId, containerId);
    setSaving(false);
    if (result.error || !result.settings) {
      setError(result.error ?? t("saveFailed"));
      return;
    }
    setError(null);
    onSaved(result.settings);
  };

  return (
    <Panel
      title={t("title")}
      description={t("description")}
      action={
        <ElevatedSwitch
          id={`post-override-${containerId}`}
          checked={editing}
          disabled={saving}
          aria-label={t("title")}
          onCheckedChange={(checked: boolean) => {
            if (checked) setEditing(true);
            else void reset();
          }}
        />
      }
    >
      {error ? (
        <p className="mb-3 flex items-center gap-2 text-xs text-destructive-ink">
          <Warning className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}

      {!editing ? (
        <p className="text-xs text-muted-foreground">{t("inheritingHint")}</p>
      ) : (
        <div className="space-y-4">
          <OverrideFields id={`post-${containerId}`} draft={draft} onChange={setDraft} effective={settings.effective} disabled={saving} />

          <div className="flex flex-wrap justify-end gap-2">
            {settings.override ? <Button size="sm" variant="secondary" title={t("reset")} disabled={saving} onClick={() => void reset()} /> : null}
            <Button size="sm" variant="primary" title={saving ? t("saving") : t("save")} disabled={saving} onClick={() => void save()} />
          </div>
        </div>
      )}
    </Panel>
  );
}

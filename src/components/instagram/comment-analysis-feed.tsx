"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { listAnalyzedCommentsAction, retryAnalyzedCommentAction } from "@/app/actions/comment-analysis";
import type {
  AnalyzedComment,
  CommentAnalysisStatus,
  CommentIntent,
  CommentListFilters,
  CommentSentiment,
  CommentStance,
  CommentTopic,
} from "@/lib/comment-analysis/types";
import { COMMENT_INTENTS, COMMENT_SENTIMENTS, COMMENT_STANCES, HIGH_SEVERITY_THRESHOLD } from "@/lib/comment-analysis/types";
import Button from "@/components/elevated-design/button";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import {
  Chip,
  EmptyState,
  IntentChip,
  Panel,
  SentimentChip,
  SeverityBar,
  Skeleton,
  StanceChip,
  topicLabel,
} from "@/components/instagram/comment-analysis-shared";
import { ArrowClockwise, ChatCircle, Warning } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * The classified feed: one card per comment with its chips and severity bar,
 * filters in one row above (dataviz interaction rule), and the failed-row
 * retry affordance the plan insists on: a comment the model kept dropping is
 * shown with its reason and a button, never silently gone.
 */

const LOCALE_TAG: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", de: "de-DE" };

type View = "all" | "action" | "high" | "failed";

const ANY = "__any";

export function CommentAnalysisFeed({
  accountId,
  containerId,
  topics,
}: {
  accountId: string;
  /** When set, only this post's comments. */
  containerId?: string;
  topics: CommentTopic[];
}) {
  const t = useTranslations("commentAnalysis.feed");
  const tTopics = useTranslations("commentAnalysis.topics");
  const tStance = useTranslations("commentAnalysis.enums.stance");
  const tSent = useTranslations("commentAnalysis.enums.sentiment");
  const tIntent = useTranslations("commentAnalysis.enums.intent");
  const tStatus = useTranslations("commentAnalysis.enums.status");
  const tReason = useTranslations("commentAnalysis.enums.failureReason");
  const locale = useLocale();
  const df = useMemo(() => new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? "pt-BR", { dateStyle: "short", timeStyle: "short" }), [locale]);
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_TAG[locale] ?? "pt-BR"), [locale]);

  const [view, setView] = useState<View>("all");
  const [stance, setStance] = useState<string>(ANY);
  const [sentiment, setSentiment] = useState<string>(ANY);
  const [intent, setIntent] = useState<string>(ANY);
  const [topic, setTopic] = useState<string>(ANY);
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<AnalyzedComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const filters = useMemo<CommentListFilters>(() => {
    const f: CommentListFilters = { accountId, containerId, page, pageSize: 20 };
    switch (view) {
      case "action":
        f.requiresAction = true;
        f.status = ["analyzed"];
        f.sort = "severity:desc";
        break;
      case "high":
        f.severityMin = HIGH_SEVERITY_THRESHOLD;
        f.status = ["analyzed"];
        f.sort = "severity:desc";
        break;
      case "failed":
        f.status = ["failed"];
        break;
      default:
        f.sort = "commentedAt:desc";
    }
    if (stance !== ANY) f.stance = stance as CommentStance;
    if (sentiment !== ANY) f.sentiment = sentiment as CommentSentiment;
    if (intent !== ANY) f.intent = intent as CommentIntent;
    if (topic !== ANY) f.topic = topic;
    return f;
  }, [accountId, containerId, page, view, stance, sentiment, intent, topic]);

  useEffect(() => {
    let cancelled = false;
    void listAnalyzedCommentsAction(filters).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else {
        setError(null);
        setItems(result.items);
        setTotal(result.meta.totalItems);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const retry = async (c: AnalyzedComment) => {
    setRetrying(c.id);
    const result = await retryAnalyzedCommentAction(c.id);
    setRetrying(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setItems((prev) => prev.map((x) => (x.id === c.id && result.comment ? result.comment : x)));
  };

  // A filter change dims the current page until the next one settles; the
  // loading flag is set here, in the handler, not in the effect.
  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
    setLoading(true);
  };

  return (
    <Panel
      title={t("title")}
      description={t("description")}
      action={
        <ElevatedPillToggle<View>
          size="sm"
          aria-label={t("viewLabel")}
          value={view}
          onChange={resetPage(setView)}
          collapseLabels="sm"
          options={[
            { value: "all", label: t("views.all") },
            { value: "action", label: t("views.action") },
            { value: "high", label: t("views.high") },
            { value: "failed", label: t("views.failed"), icon: <Warning className="h-3.5 w-3.5" weight="fill" /> },
          ]}
        />
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <ElevatedSelect value={stance} onValueChange={resetPage(setStance)} label={t("filters.stance")}>
          <ElevatedSelectItem value={ANY}>{t("filters.any")}</ElevatedSelectItem>
          {COMMENT_STANCES.map((s) => (
            <ElevatedSelectItem key={s} value={s}>
              {tStance(s)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ElevatedSelect value={sentiment} onValueChange={resetPage(setSentiment)} label={t("filters.sentiment")}>
          <ElevatedSelectItem value={ANY}>{t("filters.any")}</ElevatedSelectItem>
          {COMMENT_SENTIMENTS.map((s) => (
            <ElevatedSelectItem key={s} value={s}>
              {tSent(s)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ElevatedSelect value={intent} onValueChange={resetPage(setIntent)} label={t("filters.intent")}>
          <ElevatedSelectItem value={ANY}>{t("filters.any")}</ElevatedSelectItem>
          {COMMENT_INTENTS.map((s) => (
            <ElevatedSelectItem key={s} value={s}>
              {tIntent(s)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ElevatedSelect value={topic} onValueChange={resetPage(setTopic)} label={t("filters.topic")}>
          <ElevatedSelectItem value={ANY}>{t("filters.any")}</ElevatedSelectItem>
          {topics.map((tp) => (
            <ElevatedSelectItem key={tp.key} value={tp.key}>
              {tp.key === "other" ? tTopics("otherLabel") : tp.label}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </div>

      {error ? (
        <p className="mb-3 flex items-center gap-2 text-xs text-destructive-ink">
          <Warning className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<ChatCircle weight="duotone" />} title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className={cn("space-y-2", loading && "opacity-60")}>
          {items.map((c) => (
            <li key={c.id} className={cn("rounded-[--radius] border border-border bg-card px-4 py-3", c.status === "failed" && "border-destructive/40")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    {c.excerpt}
                    {c.truncated ? <span className="text-muted-foreground"> {t("truncated")}</span> : null}
                  </p>
                  <p className="mt-1 text-2xs text-muted-foreground">
                    {c.authorHandle ? `@${c.authorHandle}` : c.authorExternalId} · {df.format(new Date(c.commentedAt))}
                    {c.isSpam ? ` · ${t("spam")}` : ""}
                  </p>
                </div>
                {c.status === "analyzed" ? <SeverityBar severity={c.severity} /> : <StatusChip status={c.status} label={tStatus(c.status)} />}
              </div>

              {c.status === "analyzed" ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {c.stance ? <StanceChip stance={c.stance} /> : null}
                  {c.sentiment ? <SentimentChip sentiment={c.sentiment} /> : null}
                  {c.intent ? <IntentChip intent={c.intent} /> : null}
                  {c.topicKey ? <Chip>{topicLabel(topics, c.topicKey, tTopics("otherLabel"))}</Chip> : null}
                  {c.requiresAction ? <Chip className="text-warning-ink">{t("requiresAction")}</Chip> : null}
                </div>
              ) : null}

              {c.status === "failed" ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-destructive-ink">
                    {t("failedReason", { reason: knownReason(c.failureReason) ? tReason(c.failureReason as KnownReason) : (c.failureReason ?? ""), attempts: c.attempts })}
                  </p>
                  <Button size="sm" variant="secondary" icon={<ArrowClockwise className="h-3.5 w-3.5" />} title={retrying === c.id ? t("retrying") : t("retry")} disabled={retrying === c.id} onClick={() => void retry(c)} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {total > 20 ? (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("pagination", { from: (page - 1) * 20 + 1, to: Math.min(page * 20, total), total: nf.format(total) })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" title={t("previous")} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
            <Button size="sm" variant="ghost" title={t("next")} disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)} />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

const KNOWN_REASONS = [
  "missing_ref",
  "invalid_labels",
  "unparseable_response",
  "response_truncated",
  "provider_error",
  "dispatch_interrupted",
  "text_unavailable",
  "analysis_disabled",
] as const;
type KnownReason = (typeof KNOWN_REASONS)[number];

function knownReason(reason?: string): reason is KnownReason {
  return !!reason && (KNOWN_REASONS as readonly string[]).includes(reason);
}

function StatusChip({ status, label }: { status: CommentAnalysisStatus; label: string }) {
  const tone = status === "failed" ? "text-destructive-ink" : status === "pending" || status === "in_flight" ? "text-warning-ink" : "text-muted-foreground";
  return <Chip className={cn("shrink-0", tone)}>{label}</Chip>;
}

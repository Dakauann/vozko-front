"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import type {
  CommentIntent,
  CommentSentiment,
  CommentStance,
  CommentTopic,
  ModerationState,
} from "@/lib/comment-analysis/types";
import { HIGH_SEVERITY_THRESHOLD } from "@/lib/comment-analysis/types";
import { VOZ_SERIES } from "@/components/charts/vozko";
import { cn } from "@/lib/utils";

/*
 * Shared pieces of the comment-analysis dashboard.
 *
 * Colour policy (dataviz): stance and sentiment are STATES, so they take
 * the status tokens (healthy / muted / warning / destructive), never the
 * series palette; topics are ENTITIES, so they take the series tokens in the
 * account's fixed topic order and a sixth topic folds into muted. Severity
 * is carried by the number and the label as well as the colour, so a
 * colour-blind reader loses nothing.
 */

export const STANCE_COLOR: Record<CommentStance, string> = {
  supporter: "hsl(var(--healthy))",
  neutral: "hsl(var(--muted-foreground))",
  critic: "hsl(var(--warning))",
  hostile: "hsl(var(--destructive))",
};

export const STANCE_TEXT: Record<CommentStance, string> = {
  supporter: "text-healthy-ink",
  neutral: "text-muted-foreground",
  critic: "text-warning-ink",
  hostile: "text-destructive-ink",
};

export const SENTIMENT_COLOR: Record<CommentSentiment, string> = {
  positive: "hsl(var(--healthy))",
  neutral: "hsl(var(--muted-foreground))",
  negative: "hsl(var(--destructive))",
};

/** Series colour for a topic by its position in the account's set. */
export function topicColor(topics: CommentTopic[], key: string): string {
  const index = topics.findIndex((t) => t.key === key);
  if (index < 0 || index >= VOZ_SERIES.length || key === "other") {
    return "hsl(var(--muted-foreground))";
  }
  return VOZ_SERIES[index];
}

export function topicLabel(topics: CommentTopic[], key: string, otherLabel: string): string {
  if (key === "other") return otherLabel;
  return topics.find((t) => t.key === key)?.label ?? key;
}

/** Severity tone: the number is always shown; the tone only reinforces it. */
export function severityTone(severity: number): "healthy" | "warning" | "destructive" | "muted" {
  if (severity >= HIGH_SEVERITY_THRESHOLD) return "destructive";
  if (severity >= 30) return "warning";
  if (severity > 0) return "healthy";
  return "muted";
}

const TONE_BAR: Record<ReturnType<typeof severityTone>, string> = {
  healthy: "bg-healthy",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/40",
};

const TONE_TEXT: Record<ReturnType<typeof severityTone>, string> = {
  healthy: "text-healthy-ink",
  warning: "text-warning-ink",
  destructive: "text-destructive-ink",
  muted: "text-muted-foreground",
};

/**
 * The severity readout: number, a word for the band, and a bar. Three
 * channels, so red is never the only one carrying it.
 */
export function SeverityBar({ severity, compact = false }: { severity: number; compact?: boolean }) {
  const t = useTranslations("commentAnalysis.enums.severity");
  const tone = severityTone(severity);
  const band = severity >= HIGH_SEVERITY_THRESHOLD ? "high" : severity >= 30 ? "medium" : severity > 0 ? "low" : "none";
  return (
    <div className={cn("flex items-center gap-2", compact ? "min-w-[96px]" : "min-w-[140px]")}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full", TONE_BAR[tone])} style={{ width: `${Math.max(0, Math.min(100, severity))}%` }} />
      </div>
      <span className={cn("readout text-xs font-semibold tabular-nums", TONE_TEXT[tone])}>{severity}</span>
      {!compact && <span className="text-2xs text-muted-foreground">{t(band)}</span>}
    </div>
  );
}

export function Chip({
  children,
  dot,
  className,
  title,
}: {
  children: ReactNode;
  dot?: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-foreground",
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function StanceChip({ stance }: { stance: CommentStance }) {
  const t = useTranslations("commentAnalysis.enums.stance");
  return (
    <Chip dot={STANCE_COLOR[stance]} className={STANCE_TEXT[stance]}>
      {t(stance)}
    </Chip>
  );
}

export function SentimentChip({ sentiment }: { sentiment: CommentSentiment }) {
  const t = useTranslations("commentAnalysis.enums.sentiment");
  return <Chip dot={SENTIMENT_COLOR[sentiment]}>{t(sentiment)}</Chip>;
}

export function IntentChip({ intent }: { intent: CommentIntent }) {
  const t = useTranslations("commentAnalysis.enums.intent");
  return <Chip>{t(intent)}</Chip>;
}

export function ModerationChip({ state }: { state: ModerationState }) {
  const t = useTranslations("commentAnalysis.enums.moderation");
  if (state === "none") return null;
  const tone = state === "blocked" ? "text-destructive-ink" : state === "muted" ? "text-warning-ink" : "text-muted-foreground";
  return <Chip className={tone}>{t(state)}</Chip>;
}

/** Section frame used by every panel of the tab. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[--radius] border border-border bg-card", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="text-muted-foreground opacity-50 [&>svg]:h-8 [&>svg]:w-8">{icon}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[--radius] bg-muted", className)} aria-hidden />;
}

export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

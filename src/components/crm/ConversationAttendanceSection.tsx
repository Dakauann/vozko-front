"use client";

/**
 * Shared fetch for conversation_events → attendance summary + activity timeline.
 * Avoids double-hitting GET …/events when the contact panel is open.
 */

import {
  ArrowClockwise,
  ArrowSquareOut,
  ArrowsLeftRight,
  ChartBar,
  CheckCircle,
  ClockCounterClockwise,
  Phone,
  Queue,
  Robot,
  Tag,
  UserCircle,
  UserMinus,
  UserPlus,
} from "@/components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

import { listConversationEventsAction } from "@/app/actions/conversations";
import {
  listAssignableMembersAction,
  type AssignableMember,
} from "@/app/actions/workspace";
import type { EntryType } from "@/lib/conversations/types";
import {
  eventMatchesFilter,
  normalizeActorKind,
  parseEventDetails,
  type ActivityFilter,
  type ConversationEvent,
} from "@/lib/conversations/events";
import {
  attendanceMetricsHref,
  buildConversationAttendanceSummary,
  type AttendanceOwnerKind,
} from "@/lib/conversations/attendance-summary";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contexts/workspace-context";

const PAGE_SIZE = 40;

const LOCALE_TAG: Record<string, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
};

const KNOWN_EVENT_TYPES = new Set([
  "assigned",
  "auto_assigned",
  "unassigned",
  "replied",
  "reopened",
  "tag_added",
  "tag_removed",
  "label_added",
  "label_removed",
  "ai_replied",
  "ai_enabled",
  "ai_disabled",
  "ai_session_started",
  "ai_session_ended",
  "status_changed",
  "stage_changed",
  "finished",
  "analysis_created",
  "transfer_offered",
  "transfer_accepted",
  "transfer_declined",
  "transfer_completed",
  "transfer_failed",
  "transfer_queued",
  "queue_enqueued",
  "queue_connected",
  "queue_abandoned",
  "queue_overflow",
  "call_linked",
]);

type IconComp = typeof UserPlus;

function iconForEvent(type: string): { Icon: IconComp; tile: string } {
  switch (type) {
    case "assigned":
    case "auto_assigned":
      return { Icon: UserPlus, tile: "tile-brand" };
    case "unassigned":
      return { Icon: UserMinus, tile: "tile-neutral" };
    case "replied":
      return { Icon: UserCircle, tile: "tile-brand" };
    case "ai_replied":
    case "ai_enabled":
    case "ai_disabled":
    case "ai_session_started":
    case "ai_session_ended":
      return { Icon: Robot, tile: "tile-warning" };
    case "stage_changed":
    case "status_changed":
    case "finished":
    case "reopened":
      return { Icon: CheckCircle, tile: "tile-healthy" };
    case "label_added":
    case "label_removed":
    case "tag_added":
    case "tag_removed":
      return { Icon: Tag, tile: "tile-neutral" };
    case "analysis_created":
      return { Icon: ChartBar, tile: "tile-neutral" };
    case "call_linked":
      return { Icon: Phone, tile: "tile-neutral" };
    case "queue_enqueued":
    case "queue_connected":
    case "queue_abandoned":
    case "queue_overflow":
      return { Icon: Queue, tile: "tile-warning" };
    case "transfer_offered":
    case "transfer_accepted":
    case "transfer_declined":
    case "transfer_completed":
    case "transfer_failed":
    case "transfer_queued":
      return { Icon: ArrowsLeftRight, tile: "tile-warning" };
    default:
      return { Icon: ClockCounterClockwise, tile: "tile-neutral" };
  }
}

function formatWhen(iso: string, localeTag: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(localeTag, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayKey(iso: string, localeTag: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(localeTag, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Keys that are technical identifiers, never show raw to the operator. */
const DETAIL_SKIP_KEYS = new Set([
  "message_id",
  "messageId",
  "from_user_id",
  "fromUserId",
  "to_user_id",
  "toUserId",
  "user_id",
  "userId",
  "actor_id",
  "actorId",
  "entry_id",
  "entryId",
  "workspace_id",
  "workspaceId",
  "correlation_id",
  "correlationId",
  "campaign_id",
  "campaignId",
  "lead_id",
  "leadId",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function looksLikeId(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (UUID_RE.test(v)) return true;
  if (/^ai:[0-9a-f-]{8,}$/i.test(v)) return true;
  // long hex-ish tokens
  if (/^[0-9a-f]{16,}$/i.test(v)) return true;
  return false;
}

/**
 * Human-readable subtitle for a timeline event.
 * Resolves to_user_id via memberNames when possible; never dumps raw IDs.
 */
function detailLine(
  details: Record<string, string>,
  memberNames?: Record<string, string>,
  tDetails?: (key: string, values?: Record<string, string>) => string,
): string | null {
  const preferred = [
    "stage_name",
    "stageName",
    "label_name",
    "labelName",
    "to_username",
    "toUsername",
    "to_user",
    "toUser",
    "assigned_to_name",
    "assignedToName",
    "assigned_to",
    "assignedTo",
    "outcome",
    "status",
    "reason",
    "end_reason",
    "endReason",
    "from_status",
    "to_status",
    "trigger",
  ];

  const parts: string[] = [];

  // Prefer explicit human labels first
  for (const key of preferred) {
    const raw = details[key]?.trim();
    if (!raw) continue;
    if (key === "trigger" && tDetails) {
      const mapped = tDetails(`trigger.${raw}` as "trigger.open");
      // if next-intl returns the key path, fall back to raw
      parts.push(
        mapped.includes("trigger.") ? raw : mapped,
      );
      continue;
    }
    if (!looksLikeId(raw)) {
      parts.push(raw);
      break;
    }
  }

  // Resolve assignee UUID → display name
  const toId =
    details.to_user_id ||
    details.toUserId ||
    details.assigned_user_id ||
    details.assignedUserId ||
    "";
  if (toId) {
    const name =
      memberNames?.[toId] ||
      details.to_username ||
      details.toUsername ||
      details.assigned_to_name;
    if (name && !looksLikeId(name)) {
      const label = tDetails
        ? tDetails("assignedTo", { name })
        : name;
      if (!parts.includes(name) && !parts.some((p) => p.includes(name))) {
        parts.push(label.includes("assignedTo") ? name : label);
      }
    }
  }

  // Friendly leftover keys (no IDs)
  if (!parts.length) {
    for (const [key, value] of Object.entries(details)) {
      if (DETAIL_SKIP_KEYS.has(key)) continue;
      if (looksLikeId(value)) continue;
      if (key === "trigger" && tDetails) {
        const mapped = tDetails(`trigger.${value}` as "trigger.open");
        parts.push(mapped.includes("trigger.") ? value : mapped);
      } else {
        parts.push(value);
      }
      if (parts.length >= 2) break;
    }
  }

  if (!parts.length) return null;
  return parts.slice(0, 2).join(" · ");
}

function ownerTile(kind: AttendanceOwnerKind): {
  tile: string;
  Icon: typeof UserCircle;
} {
  if (kind === "ai") return { tile: "tile-warning", Icon: Robot };
  if (kind === "unassigned") return { tile: "tile-neutral", Icon: UserMinus };
  return { tile: "tile-brand", Icon: UserCircle };
}

function outcomeLabel(
  outcome: string,
  t: ReturnType<typeof useTranslations>,
): string {
  const known = [
    "contained",
    "handed_off",
    "abandoned",
    "error",
    "suppressed",
  ];
  if (known.includes(outcome)) {
    return t(`outcome.${outcome}` as "outcome.contained");
  }
  return outcome;
}

export interface ConversationAttendanceSectionProps {
  entryType: EntryType | string;
  entryId: string;
  active?: boolean;
  assignedUsername?: string | null;
  assignedUserId?: string | null;
  automationEnabled?: boolean | null;
  conversationStatus?: string | null;
  closeSource?: string | null;
  closeReason?: string | null;
  campaignId?: string | null;
  campaignType?: string | null;
  className?: string;
}

export default function ConversationAttendanceSection({
  entryType,
  entryId,
  active = true,
  assignedUsername,
  assignedUserId,
  automationEnabled,
  conversationStatus,
  closeSource,
  closeReason,
  campaignId,
  campaignType,
  className,
}: ConversationAttendanceSectionProps) {
  const tSummary = useTranslations("crmContactPanel.attendance");
  const t = useTranslations("crmContactPanel.activity");
  const locale = useLocale();
  const localeTag = LOCALE_TAG[locale] ?? "en-US";
  const { currentWorkspace } = useWorkspace();

  const [events, setEvents] = useState<ConversationEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [reloadToken, setReloadToken] = useState(0);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  // Resolve assignment UUIDs → display names for timeline subtitles.
  useEffect(() => {
    if (!active || !currentWorkspace?.id) return;
    let cancelled = false;
    (async () => {
      const res = await listAssignableMembersAction(currentWorkspace.id, {
        pageSize: 200,
      });
      if (cancelled || res.error) return;
      const map: Record<string, string> = {};
      for (const m of res.members as AssignableMember[]) {
        const id = m.userId || m.id;
        if (!id) continue;
        map[id] = m.username || m.email || id.slice(0, 8);
      }
      setMemberNames(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, currentWorkspace?.id]);

  useEffect(() => {
    if (!active || !entryId || !entryType) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await listConversationEventsAction(
        entryType as EntryType,
        entryId,
        1,
        PAGE_SIZE,
      );
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
        setEvents([]);
        setTotalPages(0);
        setTotalItems(0);
        setPage(1);
      } else {
        setEvents(res.events);
        setPage(res.page);
        setTotalPages(res.totalPages);
        setTotalItems(res.totalItems);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, entryId, entryType, reloadToken]);

  const loadMore = useCallback(async () => {
    if (!entryId || !entryType || page >= totalPages) return;
    setLoadingMore(true);
    const res = await listConversationEventsAction(
      entryType as EntryType,
      entryId,
      page + 1,
      PAGE_SIZE,
    );
    if (res.error) {
      setError(res.error);
    } else {
      setEvents((prev) => [...prev, ...res.events]);
      setPage(res.page);
      setTotalPages(res.totalPages);
      setTotalItems(res.totalItems);
    }
    setLoadingMore(false);
  }, [entryId, entryType, page, totalPages]);

  const summary = useMemo(
    () =>
      buildConversationAttendanceSummary({
        events,
        assignedUsername,
        assignedUserId,
        automationEnabled,
        conversationStatus,
        closeSource,
        closeReason,
      }),
    [
      events,
      assignedUsername,
      assignedUserId,
      automationEnabled,
      conversationStatus,
      closeSource,
      closeReason,
    ],
  );

  const filtered = useMemo(
    () => events.filter((e) => eventMatchesFilter(e, filter)),
    [events, filter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, ConversationEvent[]>();
    for (const ev of filtered) {
      const key = dayKey(ev.created_at, localeTag);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filtered, localeTag]);

  const filters: { id: ActivityFilter; label: string }[] = [
    { id: "all", label: t("filterAll") },
    { id: "human", label: t("filterHuman") },
    { id: "ai", label: t("filterAi") },
    { id: "system", label: t("filterSystem") },
    { id: "transfer", label: t("filterTransfer") },
  ];

  const hasMore = page < totalPages;
  const { tile, Icon } = ownerTile(summary.ownerKind);

  const ownerText = (() => {
    if (summary.ownerKind === "unassigned") return tSummary("ownerUnassigned");
    if (summary.ownerKind === "ai") {
      return summary.ownerLabel
        ? tSummary("ownerAiNamed", { name: summary.ownerLabel })
        : tSummary("ownerAi");
    }
    return summary.ownerLabel
      ? tSummary("ownerHumanNamed", { name: summary.ownerLabel })
      : tSummary("ownerHuman");
  })();

  const metricsHref = attendanceMetricsHref({
    campaignId,
    campaignType:
      campaignType === "whatsapp" || campaignType === "voice"
        ? campaignType
        : entryType === "whatsapp"
          ? "whatsapp"
          : entryType === "voice"
            ? "voice"
            : null,
    localePrefix: `/${locale}`,
  });

  const summaryRows: { label: string; value: string; muted?: boolean }[] = [
    {
      label: tSummary("aiToggle"),
      value: summary.aiEnabled ? tSummary("aiOn") : tSummary("aiOff"),
    },
    {
      label: tSummary("assignments"),
      value: loading ? tSummary("loading") : String(summary.assignmentEventCount),
      muted: !summary.assignmentEventCount,
    },
    {
      label: tSummary("aiSessions"),
      value: loading
        ? tSummary("loading")
        : summary.openAiSessions > 0
          ? tSummary("aiSessionsOpen", {
              total: String(summary.aiSessionStarted),
              open: String(summary.openAiSessions),
            })
          : String(summary.aiSessionStarted),
      muted: !summary.aiSessionStarted,
    },
    {
      label: tSummary("replies"),
      value: loading
        ? tSummary("loading")
        : tSummary("repliesValue", {
            human: String(summary.humanReplyCount),
            ai: String(summary.aiReplyCount),
          }),
      muted: !summary.humanReplyCount && !summary.aiReplyCount,
    },
  ];

  if (summary.lastAiOutcome) {
    summaryRows.push({
      label: tSummary("lastAiOutcome"),
      value: outcomeLabel(summary.lastAiOutcome, tSummary),
    });
  }
  if (summary.closeProvenance) {
    summaryRows.push({
      label: tSummary("closedBy"),
      value: `${summary.closeProvenance.by} · ${summary.closeProvenance.reasonLabel}`,
    });
  }
  if (summary.transferEventCount > 0) {
    summaryRows.push({
      label: tSummary("transfers"),
      value: String(summary.transferEventCount),
    });
  }

  return (
    <div className={cn("space-y-5", className)}>
      {/* ── Micro-summary ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              tile,
            )}
          >
            <Icon className="h-3.5 w-3.5" weight="fill" />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold tracking-tight text-foreground">
              {tSummary("title")}
            </h3>
            <p className="truncate text-[11px] text-muted-foreground">
              {ownerText}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {summaryRows.map((row) => (
            <div
              key={row.label}
              className={cn(
                "rounded-[--radius] border border-border bg-background px-2.5 py-2",
                row.muted && "opacity-70",
              )}
            >
              <p className="text-[11px] font-medium text-muted-foreground">
                {row.label}
              </p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">
                {row.value}
              </p>
            </div>
          ))}
        </div>

        <Link
          href={metricsHref}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <ChartBar className="h-3.5 w-3.5 text-primary-ink" weight="bold" />
          {campaignId
            ? tSummary("viewCampaignMetrics")
            : tSummary("viewMetrics")}
          <ArrowSquareOut
            className="h-3 w-3 text-muted-foreground"
            weight="bold"
          />
        </Link>
      </section>

      {/* ── Activity timeline ─────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ClockCounterClockwise className="h-3.5 w-3.5" weight="bold" />
            </span>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold tracking-tight text-foreground">
                {t("title")}
              </h3>
              <p className="text-[11px] text-muted-foreground">{t("subtitle")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReloadToken((n) => n + 1)}
            disabled={loading}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label={t("refresh")}
            title={t("refresh")}
          >
            <ArrowClockwise
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              weight="bold"
            />
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-[--radius] px-2 py-0.5 text-[11px] font-medium transition-colors",
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-[--radius] bg-muted"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[--radius] border border-border bg-muted px-3 py-3 text-center">
            <p className="text-xs text-destructive-ink">{error}</p>
            <button
              type="button"
              onClick={() => setReloadToken((n) => n + 1)}
              className="mt-2 text-xs font-semibold text-primary-ink hover:underline"
            >
              {t("retry")}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[--radius] border border-border bg-background px-3 py-6 text-center">
            <ClockCounterClockwise
              className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40"
              weight="duotone"
            />
            <p className="text-xs text-muted-foreground">
              {events.length === 0 ? t("empty") : t("emptyFilter")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(([day, dayEvents]) => (
              <div key={day}>
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                  {day}
                </p>
                <ul className="space-y-1.5">
                  {dayEvents.map((ev) => {
                    const { Icon: EvIcon, tile: evTile } = iconForEvent(
                      ev.event_type,
                    );
                    const kind = normalizeActorKind(
                      ev.actor_kind,
                      ev.actor_id,
                    );
                    const details = parseEventDetails(ev.details);
                    const sub = detailLine(
                      details,
                      memberNames,
                      (key, values) =>
                        t(`details.${key}` as "details.assignedTo", values),
                    );
                    const title = KNOWN_EVENT_TYPES.has(ev.event_type)
                      ? t(`types.${ev.event_type}` as "types.assigned")
                      : t("types.unknown", { type: ev.event_type });

                    return (
                      <li
                        key={ev.id || `${ev.event_type}-${ev.created_at}`}
                        className="flex gap-2.5 rounded-[--radius] border border-border bg-background px-2.5 py-2"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                            evTile,
                          )}
                        >
                          <EvIcon className="h-3.5 w-3.5" weight="fill" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium leading-snug text-foreground">
                              {title}
                            </p>
                            <time
                              className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                              dateTime={ev.created_at}
                            >
                              {formatWhen(ev.created_at, localeTag)}
                            </time>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-1.5 py-px font-semibold text-white",
                                kind === "ai"
                                  ? "bg-warning"
                                  : kind === "system"
                                    ? "bg-muted"
                                    : "bg-primary",
                              )}
                            >
                              {kind === "ai"
                                ? t("actorAi")
                                : kind === "system"
                                  ? t("actorSystem")
                                  : t("actorHuman")}
                            </span>
                            {ev.channel ? (
                              <span className="truncate">{ev.channel}</span>
                            ) : null}
                          </div>
                          {sub ? (
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                              {sub}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {totalItems > 0 ? (
              <p className="text-center text-[11px] text-muted-foreground">
                {t("count", {
                  shown: filtered.length,
                  total: totalItems,
                })}
              </p>
            ) : null}

            {hasMore ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {loadingMore ? (
                  <ArrowClockwise
                    className="h-3.5 w-3.5 animate-spin"
                    weight="bold"
                  />
                ) : null}
                {t("loadMore")}
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

/** Compact pill for conversation header / inbox row. */
export function AttendanceOwnerBadge({
  kind,
  className,
}: {
  kind: AttendanceOwnerKind | "ai_active";
  className?: string;
}) {
  const t = useTranslations("crmContactPanel.attendance");
  const isAi = kind === "ai" || kind === "ai_active";
  const label =
    kind === "ai_active"
      ? t("badgeAiActive")
      : isAi
        ? t("badgeAi")
        : kind === "unassigned"
          ? t("badgeUnassigned")
          : t("badgeHuman");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[--radius] px-2 py-0.5 text-[11px] font-semibold text-white",
        isAi
          ? "bg-warning"
          : kind === "unassigned"
            ? "bg-muted"
            : "bg-primary",
        className,
      )}
    >
      {isAi ? (
        <Robot className="h-3 w-3" weight="fill" />
      ) : (
        <UserCircle className="h-3 w-3" weight="fill" />
      )}
      {label}
    </span>
  );
}

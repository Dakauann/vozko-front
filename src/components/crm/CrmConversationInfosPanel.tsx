"use client";

import {
  ArrowClockwise,
  ArrowsOutSimple,
  ArrowsInSimple,
  Check,
  ClockCounterClockwise,
  Copy,
  Phone,
  Prohibit,
  ShieldCheck,
  TrendUp,
  UserCircle,
  WhatsappLogo,
  X,
} from "@/components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type {
  ActiveConversation,
  InboxEntry,
} from "@/lib/conversations/types";
import { blockLeadAction } from "@/app/actions/leads";
import { listOpportunitiesForEntryAction } from "@/app/actions/opportunities";
import ConversationAttendanceSection from "@/components/crm/ConversationAttendanceSection";
import ConversationPathChart from "@/components/crm/ConversationPathChart";
import CrmSegmentedToggle from "@/components/crm/CrmSegmentedToggle";
import { type Opportunity, formatValueCents } from "@/lib/crm/opportunities";
import { cn } from "@/lib/utils";

// Status → meaning dot (color rides the dot only, never a same-colour tint behind it).
const DEAL_STATUS_DOT: Record<string, string> = {
  open: "bg-primary",
  won: "bg-healthy",
  lost: "bg-muted",
};

type PanelTab = "contact" | "attendance" | "insights";

interface CrmConversationInfosPanelProps {
  open: boolean;
  onClose: () => void;
  conversation: ActiveConversation | null;
  inboxEntry: InboxEntry | null;
  /** Resolved CRM status from layout (new | ongoing | finished). */
  conversationStatus?: "new" | "ongoing" | "finished" | string | null;
  canBlock: boolean;
}

/**
 * Formats a stored E.164-ish Brazilian number (e.g. 5511998887777) into a
 * readable +55 (11) 99888-7777. Falls back to the raw value for anything that
 * doesn't match the expected shape.
 */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const br = digits.startsWith("55") ? digits.slice(2) : digits;
  if (br.length === 11) {
    return `+55 (${br.slice(0, 2)}) ${br.slice(2, 7)}-${br.slice(7)}`;
  }
  if (br.length === 10) {
    return `+55 (${br.slice(0, 2)}) ${br.slice(2, 6)}-${br.slice(6)}`;
  }
  return raw.startsWith("+") ? raw : `+${digits}`;
}

function initialsOf(name: string | null | undefined, fallback: string): string {
  const source = (name ?? "").trim();
  if (!source) return fallback.replace(/\D/g, "").slice(-2) || "#";
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "#";
}

/**
 * Context rail (industry pattern: HubSpot / Intercom / Zendesk / Front).
 * Default ~416px, expandable ~480px on large screens. Tabs avoid endless scroll.
 * Sticky identity header + scroll body; danger actions stay pinned bottom.
 */
export default function CrmConversationInfosPanel({
  open,
  onClose,
  conversation,
  inboxEntry,
  conversationStatus,
  canBlock,
}: CrmConversationInfosPanelProps) {
  const t = useTranslations("crmContactPanel");

  const [blocking, setBlocking] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [copied, setCopied] = useState(false);
  const [blockedOverride, setBlockedOverride] = useState<boolean | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tab, setTab] = useState<PanelTab>("contact");
  /** Wider context rail (xl+), closer to HubSpot / Zendesk default. */
  const [expanded, setExpanded] = useState(false);

  const isWhatsApp = conversation?.entry_type === "whatsapp";
  const leadNumber = conversation?.lead_number ?? "";
  const leadName = conversation?.lead_name ?? "";
  const leadId = inboxEntry?.lead_id ?? "";

  useEffect(() => {
    setConfirmingBlock(false);
    setBlockedOverride(null);
    setTab("contact");
  }, [inboxEntry?.entry_id, inboxEntry?.entry_type]);

  useEffect(() => {
    const entryId = conversation?.entry_id;
    const entryType = conversation?.entry_type;
    if (!open || !entryId || !entryType) {
      setOpportunities([]);
      return;
    }
    let cancelled = false;
    void listOpportunitiesForEntryAction(entryId, entryType).then((res) => {
      if (!cancelled && !res.error) setOpportunities(res.opportunities);
    });
    return () => {
      cancelled = true;
    };
  }, [open, conversation?.entry_id, conversation?.entry_type]);

  const isBlocked = blockedOverride ?? Boolean(inboxEntry?.blocked);

  const metadataEntries = useMemo(() => {
    const meta = (conversation?.lead_metadata ?? {}) as Record<string, unknown>;
    return Object.entries(meta)
      .filter(([key, value]) => {
        if (key === "template_info") return false;
        if (value === null || value === undefined || value === "") return false;
        return typeof value !== "object";
      })
      .map(([key, value]) => [key, String(value)] as const)
      .slice(0, 8);
  }, [conversation?.lead_metadata]);

  const handleCopy = useCallback(async () => {
    if (!leadNumber) return;
    try {
      await navigator.clipboard.writeText(formatPhone(leadNumber));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable, non-critical */
    }
  }, [leadNumber]);

  const handleToggleBlock = useCallback(async () => {
    if (!leadId || blocking) return;
    const nextBlocked = !isBlocked;
    setBlocking(true);
    try {
      const result = await blockLeadAction(
        leadId,
        nextBlocked,
        isWhatsApp ? inboxEntry?.business_phone_id : undefined,
      );
      if (result.error) {
        toast.error(nextBlocked ? t("blockError") : t("unblockError"), {
          description: result.error,
        });
        return;
      }
      setBlockedOverride(nextBlocked);
      setConfirmingBlock(false);
      if (nextBlocked) {
        toast.success(t("blockSuccess"), {
          description:
            isWhatsApp && !result.metaApplied
              ? t("blockMetaPending")
              : undefined,
        });
      } else {
        toast.success(t("unblockSuccess"));
      }
    } finally {
      setBlocking(false);
    }
  }, [leadId, blocking, isBlocked, isWhatsApp, inboxEntry?.business_phone_id, t]);

  const windowOpen = conversation?.window_open ?? inboxEntry?.window_open;
  const assignedUsername = inboxEntry?.assigned_username;
  const stage = inboxEntry?.stage;
  const labels = inboxEntry?.labels ?? [];

  const tabOptions = useMemo(
    () => [
      { value: "contact" as const, label: t("tabs.contact") },
      {
        value: "attendance" as const,
        label: t("tabs.attendance"),
        icon: <ClockCounterClockwise className="h-3 w-3" weight="bold" />,
      },
      {
        value: "insights" as const,
        label: t("tabs.insights"),
        icon: <TrendUp className="h-3 w-3" weight="bold" />,
      },
    ],
    [t],
  );

  return (
    <aside
      aria-hidden={!open}
      className={cn(
        // Mobile: slide-over. Desktop: inline context rail (industry ~360–480px).
        "absolute inset-y-0 right-0 z-30 flex h-full flex-col bg-card",
        "border-l border-border shadow-xl transition-[transform,width] duration-200 ease-out",
        "w-full max-w-md sm:max-w-lg",
        "lg:static lg:z-auto lg:max-w-none lg:shadow-none",
        open
          ? cn(
              "translate-x-0",
              // Default 26rem (416px); expanded 30rem (480px) on xl, matches HubSpot/Zendesk rails.
              expanded
                ? "lg:w-[26rem] xl:w-[30rem]"
                : "lg:w-[24rem] xl:w-[26rem]",
            )
          : "translate-x-full lg:w-0 lg:translate-x-0 lg:overflow-hidden lg:border-l-0",
      )}
    >
      {/* Sticky chrome: title + expand + close */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <h2 className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="hidden h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground xl:inline-flex"
            aria-label={expanded ? t("collapsePanel") : t("expandPanel")}
            title={expanded ? t("collapsePanel") : t("expandPanel")}
          >
            {expanded ? (
              <ArrowsInSimple className="h-4 w-4" weight="bold" />
            ) : (
              <ArrowsOutSimple className="h-4 w-4" weight="bold" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X weight="bold" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!conversation ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <UserCircle
            weight="thin"
            className="h-12 w-12 text-muted-foreground/50"
          />
          <p className="text-xs text-muted-foreground">{t("emptyState")}</p>
        </div>
      ) : (
        <>
          {/* Sticky identity (compact horizontal, not a tall marketing hero) */}
          <div className="shrink-0 border-b border-border px-3 py-3">
            {isBlocked && (
              <div className="mb-2.5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-muted px-2.5 py-2 text-destructive-ink">
                <Prohibit weight="fill" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold">{t("blockedTitle")}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-destructive/90">
                    {t("blockedDescription")}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm",
                  isWhatsApp ? "bg-healthy" : "bg-muted",
                  isBlocked && "grayscale",
                )}
              >
                {leadName ? (
                  initialsOf(leadName, leadNumber)
                ) : isWhatsApp ? (
                  <WhatsappLogo weight="fill" className="h-6 w-6" />
                ) : (
                  <Phone weight="fill" className="h-6 w-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {leadName || formatPhone(leadNumber)}
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="group mt-0.5 inline-flex max-w-full items-center gap-1.5 truncate text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="truncate">{formatPhone(leadNumber)}</span>
                  {copied ? (
                    <Check
                      weight="bold"
                      className="h-3 w-3 shrink-0 text-healthy"
                    />
                  ) : (
                    <Copy
                      weight="bold"
                      className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  )}
                </button>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-[--radius] border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground">
                    {isWhatsApp ? (
                      <WhatsappLogo
                        weight="fill"
                        className="h-3 w-3 text-healthy"
                      />
                    ) : (
                      <Phone weight="fill" className="h-3 w-3 text-info-ink" />
                    )}
                    {isWhatsApp ? t("channelWhatsapp") : t("channelVoice")}
                  </span>
                  {assignedUsername ? (
                    <span className="inline-flex max-w-[10rem] truncate rounded-[--radius] bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {assignedUsername}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <CrmSegmentedToggle
                options={tabOptions}
                value={tab}
                onChange={setTab}
                className="w-full justify-between sm:justify-start [&>button]:flex-1 sm:[&>button]:flex-none"
              />
            </div>
          </div>

          {/* Scrollable tab body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "contact" && (
              <dl className="flex flex-col gap-px bg-border/60">
                {isWhatsApp && (
                  <InfoRow label={t("windowStatus")}>
                    {windowOpen ? (
                      <span className="inline-flex items-center gap-1.5 text-healthy">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-healthy" />
                        {t("windowOpen")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-warning">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                        {t("windowClosed")}
                      </span>
                    )}
                  </InfoRow>
                )}

                {inboxEntry?.campaign_name ? (
                  <InfoRow label={t("campaign")}>
                    <span className="max-w-[12rem] truncate text-foreground">
                      {inboxEntry.campaign_name}
                    </span>
                  </InfoRow>
                ) : null}

                <InfoRow label={t("aiResponses")}>
                  {(conversation.automation_enabled ??
                    inboxEntry?.automation_enabled) !== false ? (
                    <span className="inline-flex items-center gap-1.5 text-healthy">
                      <span className="h-1.5 w-1.5 rounded-full bg-healthy" />
                      {t("aiOn")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted" />
                      {t("aiOff")}
                    </span>
                  )}
                </InfoRow>

                {(inboxEntry?.unread_count ?? conversation.unread_count ?? 0) >
                0 ? (
                  <InfoRow label={t("unread")}>
                    <span className="font-semibold tabular-nums text-foreground">
                      {inboxEntry?.unread_count ?? conversation.unread_count}
                    </span>
                  </InfoRow>
                ) : null}

                <InfoRow label={t("assignedAgent")}>
                  {assignedUsername ? (
                    <span className="text-foreground">{assignedUsername}</span>
                  ) : (
                    <span className="text-muted-foreground/70">
                      {t("unassigned")}
                    </span>
                  )}
                </InfoRow>

                {stage && (
                  <InfoRow label={t("stage")}>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-[--radius] px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: `${stage.color}1a`,
                        color: stage.color,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </span>
                  </InfoRow>
                )}

                {labels.length > 0 && (
                  <InfoRow label={t("labels")}>
                    <div className="flex flex-wrap justify-end gap-1">
                      {labels.map((label) => (
                        <span
                          key={label.label_id}
                          className="inline-flex items-center gap-1 rounded-[--radius] px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: `${label.color}1a`,
                            color: label.color,
                          }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  </InfoRow>
                )}

                {metadataEntries.map(([key, value]) => (
                  <InfoRow key={key} label={key}>
                    <span className="break-words text-foreground">{value}</span>
                  </InfoRow>
                ))}
              </dl>
            )}

            {tab === "attendance" && (
              <div className="px-3 py-4">
                <ConversationAttendanceSection
                  entryType={conversation.entry_type}
                  entryId={conversation.entry_id}
                  active={open && tab === "attendance"}
                  assignedUsername={inboxEntry?.assigned_username}
                  assignedUserId={inboxEntry?.assigned_user_id}
                  automationEnabled={
                    conversation.automation_enabled ??
                    inboxEntry?.automation_enabled
                  }
                  conversationStatus={
                    conversationStatus ??
                    conversation.conversation_status ??
                    inboxEntry?.conversation_status
                  }
                  closeSource={
                    conversation.close_source ?? inboxEntry?.close_source
                  }
                  closeReason={
                    conversation.close_reason ?? inboxEntry?.close_reason
                  }
                  campaignId={inboxEntry?.campaign_id}
                  campaignType={conversation.entry_type}
                />
              </div>
            )}

            {tab === "insights" && (
              <div className="space-y-4 px-3 py-4">
                <ConversationPathChart
                  status={
                    conversationStatus ??
                    conversation.conversation_status ??
                    inboxEntry?.conversation_status ??
                    "new"
                  }
                  messages={conversation.messages}
                  analysis={inboxEntry?.latest_analysis ?? null}
                />

                <div>
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
                      <TrendUp weight="bold" className="h-3 w-3 text-white" />
                    </span>
                    <h4 className="text-xs font-semibold text-foreground">
                      {t("opportunities")}
                    </h4>
                  </div>
                  {opportunities.length === 0 ? (
                    <p className="rounded-[--radius] border border-border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
                      {t("noOpportunities")}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {opportunities.map((o) => (
                        <div
                          key={o.id}
                          className="rounded-lg border border-border bg-card px-2.5 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                DEAL_STATUS_DOT[o.status] ??
                                  "bg-muted-foreground/40",
                              )}
                              title={o.status}
                            />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                              {o.title || t("untitledDeal")}
                            </span>
                            {o.valueCents > 0 && (
                              <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                                {formatValueCents(o.valueCents, o.currency)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Danger zone pinned */}
      {conversation && canBlock && (
        <div className="shrink-0 border-t border-border bg-card px-3 py-3">
          {isBlocked ? (
            <button
              type="button"
              onClick={handleToggleBlock}
              disabled={blocking}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted",
                blocking && "pointer-events-none opacity-60",
              )}
            >
              {blocking ? (
                <ArrowClockwise
                  weight="bold"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <ShieldCheck weight="bold" className="h-4 w-4" />
              )}
              {t("unblockAction")}
            </button>
          ) : confirmingBlock ? (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {isWhatsApp ? t("confirmBlockWhatsapp") : t("confirmBlock")}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingBlock(false)}
                  disabled={blocking}
                  className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleToggleBlock}
                  disabled={blocking}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive",
                    blocking && "pointer-events-none opacity-70",
                  )}
                >
                  {blocking && (
                    <ArrowClockwise
                      weight="bold"
                      className="h-4 w-4 animate-spin"
                    />
                  )}
                  {t("confirmBlockAction")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingBlock(true)}
              disabled={!leadId}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-md border border-destructive/30 bg-card px-3 py-2 text-sm font-medium text-destructive-ink transition-colors hover:bg-muted",
                !leadId && "pointer-events-none opacity-50",
              )}
            >
              <Prohibit weight="bold" className="h-4 w-4" />
              {t("blockAction")}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 bg-card px-4 py-2.5">
      <dt className="text-xs font-medium capitalize text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right text-xs font-medium">{children}</dd>
    </div>
  );
}

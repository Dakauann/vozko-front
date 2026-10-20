"use client";

import {
  ArrowClockwise,
  Brain,
  ClockCounterClockwise,
  Phone,
  Prohibit,
  ShieldCheck,
  TrendUp,
  UserCircle,
  UsersThree,
  WhatsappLogo,
  X,
} from "@/components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type {
  ActiveConversation,
  EntryType,
  InboxEntry,
} from "@/lib/conversations/types";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import OpportunityDrawer from "@/components/crm/OpportunityDrawer";
import { CopyValueButton } from "@/components/crm/CopyValueButton";
import { LeadOtherConversations } from "@/components/crm/LeadOtherConversations";
import { useInfoPanelPreferences } from "@/hooks/use-info-panel-preferences";
import { useOpportunityDrawer } from "@/hooks/use-opportunity-creation";
import type { InfoPanelTab } from "@/lib/crm/info-panel-preferences";
import { looksLikeEmail } from "@/lib/text/email-shape";
import { leadPresence, type LeadPatch } from "@/lib/conversations/lead-patch";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { blockLeadAction } from "@/app/actions/leads";
import { EditableLeadName } from "@/components/leads/EditableLeadName";
import { listOpportunitiesForEntryAction } from "@/app/actions/opportunities";
import { ChannelLogo } from "@/components/icons/channel-logos";
import { useChannelName } from "@/hooks/use-channel-name";
import { Notice } from "@/components/ui/notice";
import { AssigneeGlyph } from "@/components/crm/AssigneeGlyph";
import ConversationAttendanceSection from "@/components/crm/ConversationAttendanceSection";
import { ConversationWorkflowRuns } from "@/components/crm/ConversationWorkflowRuns";
import { ContactInfoRow as InfoRow } from "@/components/crm/ContactInfoRow";
import { ConversationLeadRows, ConversationLeadSummary } from "@/components/crm/ConversationLeadCard";
import { ConversationPortfolio } from "@/components/customer-portfolio/ConversationPortfolio";
import ConversationGroupSection from "@/components/crm/ConversationGroupSection";
import LeadMemoriesSection from "@/components/crm/LeadMemoriesSection";
import ConversationPathChart from "@/components/crm/ConversationPathChart";
import { effectiveAnalysis } from "@/lib/analysis/live";
import CrmSegmentedToggle from "@/components/crm/CrmSegmentedToggle";
import { type Opportunity, dealActorName, formatValueCents } from "@/lib/crm/opportunities";
import { cn } from "@/lib/utils";
import { formatPhoneForDisplay } from "@/lib/phone/display";

const NO_MEMBERS: ReadonlyMap<string, string> = new Map();

const DEAL_STATUS_DOT: Record<string, string> = {
  open: "bg-primary",
  won: "bg-healthy",
  lost: "bg-muted",
};

interface CrmConversationInfosPanelProps {
  open: boolean;
  onClose: () => void;
  conversation: ActiveConversation | null;
  inboxEntry: InboxEntry | null;
  conversationStatus?: "new" | "ongoing" | "finished" | string | null;
  canBlock: boolean;
  canManageMemories: boolean;
  canRenameLead: boolean;
  onLeadPatched: (leadId: string, patch: LeadPatch) => void;
  presentation?: "docked" | "sheet";
  canReadLead?: boolean;
  workspaceId?: string;
  onOpenConversation?: (entryId: string, entryType: EntryType) => void;
}

function initialsOf(name: string | null | undefined, fallback: string): string {
  const source = (name ?? "").trim();
  if (!source) return fallback.replace(/\D/g, "").slice(-2) || "#";
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "#";
}

export default function CrmConversationInfosPanel({
  open,
  onClose,
  conversation,
  inboxEntry,
  conversationStatus,
  canBlock,
  canManageMemories,
  canRenameLead,
  onLeadPatched,
  presentation = "docked",
  canReadLead = false,
  workspaceId,
  onOpenConversation,
}: CrmConversationInfosPanelProps) {
  const t = useTranslations("crmContactPanel");
  const tLeads = useTranslations("leads");
  const tDrawer = useTranslations("opportunityDrawer");
  const { tab, setTab } = useInfoPanelPreferences();
  const dealDrawer = useOpportunityDrawer();
  const [opportunitiesVersion, setOpportunitiesVersion] = useState(0);
  const dealOwnerLabels = useMemo(
    () => ({
      ai: t("dealOwnerAI"),
      workflow: t("dealOwnerWorkflow"),
      system: t("dealOwnerSystem"),
      unknownMember: t("dealOwnerTeam"),
    }),
    [t],
  );

  const [blocking, setBlocking] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  const isWhatsApp = conversation?.entry_type === "whatsapp";
  const leadNumber = conversation?.lead_number ?? "";
  const leadName = conversation?.lead_name ?? "";
  const leadId = inboxEntry?.lead_id ?? conversation?.lead_id ?? "";
  const leadVersion = leadPresence([inboxEntry, conversation], leadId).version;

  const isGroup = Boolean(conversation?.is_group ?? inboxEntry?.is_group);

  const leadCard =
    conversation && leadId && !isGroup
      ? {
          entryId: conversation.entry_id,
          entryType: conversation.entry_type,
          leadId,
          leadVersion,
          active: open,
          onLeadPatched,
        }
      : null;

  const identityKey = `${conversation?.entry_type ?? ""}:${conversation?.entry_id ?? ""}`;
  const channelNameOf = useChannelName();
  const channelName = channelNameOf(conversation?.entry_type);

  const blockEntryKey = `${inboxEntry?.entry_type ?? ""}:${inboxEntry?.entry_id ?? ""}`;
  const [confirmingBlockFor, setConfirmingBlockFor] = useState(blockEntryKey);
  if (confirmingBlockFor !== blockEntryKey) {
    setConfirmingBlockFor(blockEntryKey);
    setConfirmingBlock(false);
  }

  const activeTab: InfoPanelTab =
    (!isGroup && tab === "group") || (isGroup && tab === "memories")
      ? "contact"
      : tab;

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
  }, [open, conversation?.entry_id, conversation?.entry_type, opportunitiesVersion]);

  const openOpportunity = useCallback(
    (opportunity: Opportunity) => {
      void dealDrawer.edit(opportunity).then((opened) => {
        if (!opened) toast.error(tDrawer("openFailed"));
      });
    },
    [dealDrawer, tDrawer],
  );

  const isBlocked = Boolean(inboxEntry?.blocked ?? conversation?.blocked);

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
          description: codedErrorMessage(tLeads, result.error, "") || undefined,
        });
        return;
      }
      const { outcome } = result;
      onLeadPatched(leadId, { blocked: outcome.blocked, lead_version: outcome.version });
      setConfirmingBlock(false);
      if (outcome.blocked) {
        toast.success(t("blockSuccess"), {
          description:
            isWhatsApp && !outcome.metaApplied
              ? t("blockMetaPending")
              : undefined,
        });
      } else {
        toast.success(t("unblockSuccess"));
      }
    } finally {
      setBlocking(false);
    }
  }, [leadId, blocking, isBlocked, isWhatsApp, inboxEntry?.business_phone_id, onLeadPatched, t, tLeads]);

  const windowOpen = conversation?.window_open ?? inboxEntry?.window_open;
  const assignedUsername = inboxEntry?.assigned_username;
  const stage = inboxEntry?.stage;
  const labels = inboxEntry?.labels ?? [];

  const tabOptions = useMemo(
    () => [
      { value: "contact" as const, label: t("tabs.contact") },
      ...(isGroup
        ? [
            {
              value: "group" as const,
              label: t("tabs.group"),
              icon: <UsersThree className="h-3 w-3" weight="bold" />,
            },
          ]
        : []),
      ...(isGroup
        ? []
        : [
            {
              value: "memories" as const,
              label: t("tabs.memories"),
              icon: <Brain className="h-3 w-3" weight="bold" />,
            },
          ]),
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
    [t, isGroup],
  );

  const panelBody = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        {presentation === "sheet" ? (
          <ElevatedSheetTitle className="min-w-0 truncate text-sm font-semibold tracking-tight">{t("title")}</ElevatedSheetTitle>
        ) : (
          <h2 className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">{t("title")}</h2>
        )}
        {presentation === "docked" ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X weight="bold" className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {!conversation ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <UserCircle
            weight="thin"
            className="h-12 w-12 text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">{t("emptyState")}</p>
        </div>
      ) : (
        <>
          {}
          <div className="shrink-0 border-b border-border px-3 py-3">
            {isBlocked && (
              <Notice tone="fault" title={t("blockedTitle")} icon={<Prohibit weight="fill" />} className="mb-2.5">
                <p>{t("blockedDescription")}</p>
              </Notice>
            )}

            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm",
                  isWhatsApp ? "bg-healthy" : "bg-muted",
                  isBlocked && "grayscale",
                )}
              >
                {isGroup ? (
                  <UsersThree weight="fill" className="h-6 w-6" />
                ) : leadName ? (
                  initialsOf(leadName, leadNumber)
                ) : isWhatsApp ? (
                  <WhatsappLogo weight="fill" className="h-6 w-6" />
                ) : (
                  <Phone weight="fill" className="h-6 w-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {leadId && !isGroup ? (
                  <EditableLeadName
                    leadId={leadId}
                    name={leadName}
                    version={leadVersion}
                    fallback={formatPhoneForDisplay(leadNumber)}
                    canEdit={canRenameLead}
                    onLeadChanged={(lead) =>
                      onLeadPatched(leadId, { lead_name: lead.name, lead_version: lead.version })
                    }
                    size="md"
                    className="max-w-full text-sm font-semibold tracking-tight text-foreground"
                  />
                ) : (
                  <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {leadName || (isGroup ? t("unnamedGroup") : formatPhoneForDisplay(leadNumber))}
                  </p>
                )}
                {isGroup ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {t("groupSubtitle")}
                  </p>
                ) : (
                  <div className="mt-0.5">
                    <CopyValueButton value={formatPhoneForDisplay(leadNumber)} label={t("copyPhone")} copiedMessage={t("phoneCopied")}>
                      {formatPhoneForDisplay(leadNumber)}
                    </CopyValueButton>
                  </div>
                )}
                {leadCard ? <ConversationLeadSummary key={`lead-summary:${identityKey}`} {...leadCard} /> : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-[--radius] border border-border bg-card px-2 py-0.5 text-2xs font-semibold text-foreground">
                    {channelName ? (
                      <ChannelLogo
                        channel={conversation.entry_type}
                        className="h-3 w-3"
                      />
                    ) : (
                      <Phone weight="fill" className="h-3 w-3 text-info-ink" />
                    )}
                    {channelName ?? t("channelVoice")}
                  </span>
                  {assignedUsername ? (
                    <span className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-[--radius] bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                      <AssigneeGlyph
                        assignedUserId={inboxEntry?.assigned_user_id}
                        className="h-3 w-3 flex-shrink-0"
                      />
                      {assignedUsername}
                    </span>
                  ) : null}
                </div>
                {conversation && !isGroup ? (
                  <ConversationPortfolio
                    key={`portfolio:${identityKey}`}
                    entryType={conversation.entry_type}
                    entryId={conversation.entry_id}
                    active={open}
                  />
                ) : null}
              </div>
            </div>

            <div className="mt-3">
              <CrmSegmentedToggle
                options={tabOptions}
                value={activeTab}
                onChange={setTab}
                className="w-full justify-between sm:justify-start [&>button]:flex-1 sm:[&>button]:flex-none"
              />
            </div>
          </div>

          {}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === "contact" && (
              <dl className="flex flex-col gap-px bg-border/60">
                {leadCard ? <ConversationLeadRows key={`lead-rows:${identityKey}`} {...leadCard} /> : null}
                {isWhatsApp && (
                  <InfoRow label={t("windowStatus")}>
                    {windowOpen ? (
                      <span className="inline-flex items-center gap-1.5 text-healthy-ink">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-healthy" />
                        {t("windowOpen")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-warning-ink">
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
                    <span className="inline-flex items-center gap-1.5 text-healthy-ink">
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
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <AssigneeGlyph
                        assignedUserId={inboxEntry?.assigned_user_id}
                        className="h-3 w-3 flex-shrink-0"
                      />
                      {assignedUsername}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("unassigned")}
                    </span>
                  )}
                </InfoRow>

                {stage && (
                  <InfoRow label={t("stage")}>
                    <span className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-foreground">
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
                          className="inline-flex items-center gap-1 rounded-[--radius] border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-foreground"
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: label.color }}
                          />
                          {label.name}
                        </span>
                      ))}
                    </div>
                  </InfoRow>
                )}

                {metadataEntries.map(([key, value]) => (
                  <InfoRow key={key} label={key}>
                    {looksLikeEmail(value) ? (
                      <CopyValueButton value={value.trim()} label={t("copyEmail")} copiedMessage={t("emailCopied")}>
                        <span className="text-foreground">{value}</span>
                      </CopyValueButton>
                    ) : (
                      <span className="break-words text-foreground">{value}</span>
                    )}
                  </InfoRow>
                ))}
              </dl>
            )}
            {activeTab === "contact" && leadId && !isGroup && canReadLead ? (
              <div className="border-t border-border">
                <LeadOtherConversations
                  key={leadId}
                  leadId={leadId}
                  current={{ entryId: conversation.entry_id, entryType: conversation.entry_type }}
                  active={open}
                  onOpenConversation={onOpenConversation}
                />
              </div>
            ) : null}

            {activeTab === "group" && conversation && (
              <ConversationGroupSection
                key={conversation.entry_id}
                entryId={conversation.entry_id}
                active={open && activeTab === "group"}
              />
            )}

            {activeTab === "memories" && !isGroup && (
              <LeadMemoriesSection
                key={leadId || "no-lead"}
                leadId={leadId || null}
                canManage={canManageMemories}
              />
            )}

            {activeTab === "attendance" && (
              <div className="px-3 py-4">
                <ConversationAttendanceSection
                  entryType={conversation.entry_type}
                  entryId={conversation.entry_id}
                  active={open && activeTab === "attendance"}
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
                  closeOutcome={
                    conversation.close_outcome ?? inboxEntry?.close_outcome
                  }
                  campaignId={inboxEntry?.campaign_id}
                  campaignType={conversation.entry_type}
                />
                <div className="mt-4 border-t border-border pt-4">
                  <ConversationWorkflowRuns
                    key={identityKey}
                    entryType={conversation.entry_type}
                    entryId={conversation.entry_id}
                    active={open && activeTab === "attendance"}
                  />
                </div>
              </div>
            )}

            {activeTab === "insights" && (
              <div className="space-y-4 px-3 py-4">
                <ConversationPathChart
                  status={
                    conversationStatus ??
                    conversation.conversation_status ??
                    inboxEntry?.conversation_status ??
                    "new"
                  }
                  messages={conversation.messages}
                  analysis={inboxEntry ? effectiveAnalysis(inboxEntry) : null}
                />

                <div>
                  <div className="mb-2 flex items-center gap-1.5">
                    <TrendUp
                      weight="bold"
                      className="h-3.5 w-3.5 text-primary-ink"
                    />
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
                        <button
                          type="button"
                          key={o.id}
                          onClick={() => openOpportunity(o)}
                          disabled={dealDrawer.loading}
                          aria-label={t("openOpportunity", { title: o.title || t("untitledDeal") })}
                          className="rounded-lg border border-border bg-card px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
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
                              <span className="shrink-0 text-2xs font-semibold tabular-nums text-muted-foreground">
                                {formatValueCents(o.valueCents, o.currency)}
                              </span>
                            )}
                          </div>
                          {o.ownerId ? (
                            <p className="mt-0.5 pl-4 text-2xs text-muted-foreground">
                              {t("dealOwner", {
                                name: dealActorName(o.ownerId, NO_MEMBERS, dealOwnerLabels, o.ownerName) ?? "",
                              })}
                            </p>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {conversation && canBlock && !isGroup && (
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
              <p className="text-2xs leading-relaxed text-muted-foreground">
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
                "flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-destructive-ink transition-colors hover:bg-muted",
                !leadId && "pointer-events-none opacity-50",
              )}
            >
              <Prohibit weight="bold" className="h-4 w-4" />
              {t("blockAction")}
            </button>
          )}
        </div>
      )}
      {dealDrawer.setup ? (
        <OpportunityDrawer
          open={dealDrawer.open}
          onOpenChange={dealDrawer.setOpen}
          opportunity={dealDrawer.opportunity}
          pipelineId={dealDrawer.setup.pipelineId}
          columns={dealDrawer.setup.columns}
          customFields={dealDrawer.setup.customFields}
          workspaceId={workspaceId}
          onSaved={() => setOpportunitiesVersion((version) => version + 1)}
        />
      ) : null}
    </>
  );

  if (presentation === "sheet") {
    return (
      <ElevatedSheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
        <ElevatedSheetContent side="right" className="w-full max-w-md gap-0 p-0 sm:max-w-lg [&>button:last-child]:right-3 [&>button:last-child]:top-2">
          <ElevatedSheetDescription className="sr-only">{t("toggleTooltip")}</ElevatedSheetDescription>
          {panelBody}
        </ElevatedSheetContent>
      </ElevatedSheet>
    );
  }

  return (
    <aside
      aria-hidden={!open}
      inert={!open}
      className={cn("h-full w-full flex-col border-l border-border bg-card", open ? "flex" : "hidden")}
    >
      {panelBody}
    </aside>
  );
}

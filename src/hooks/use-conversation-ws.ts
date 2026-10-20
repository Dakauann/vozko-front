"use client";

import type {
  ActiveConversation,
  CampaignType,
  ContainerKind,
  ConnectedUser,
  ConnectionStatus,
  ConversationMessage,
  EntryType,
  HistoryDirection,
  InboxEntry,
  MediaType,
  ViewMode,
  WhatsAppCampaignTypeFilter,
  WsAnalysisUpdatePayload,
  WsHistoryPayload,
  WsSearchInboxPayload,
  WsServerEvent,
  PendingOutcomeRequest,
} from "@/lib/conversations/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeWireMessage } from "@/lib/conversations/message-wire";
import { isEntryType } from "@/lib/conversations/deep-link";
import { mergeWindowClosed, readWindowClosed } from "@/lib/conversations/window-closed";
import {
  applyHistoryPage,
  applyLiveMessage,
  applyMessageUpdate,
  newestMessageAt,
  type HistoryPage,
  type ThreadMessages,
} from "@/lib/conversations/thread-merge";
import {
  emptyOutbox,
  enqueueSend,
  failSend,
  outboxCommand,
  replayableSends,
  resendingMessageIds,
  retrySend as retryOutboxSend,
  settleDelivered,
  settleSend,
  type Outbox,
  type OutboxItem,
  type OutboxPayload,
  type SendButtonWsInput,
} from "@/lib/conversations/outbox";
import {
  loadAfterPayload,
  loadAroundPayload,
  presentPayload,
  type HistoryAnchor,
} from "@/lib/conversations/history-anchor";
import {
  forgetHistoryRequests,
  hasHistoryRequest,
  noHistoryRequests,
  requestHistory,
  routeHistoryPage,
  type HistoryHolder,
  type HistoryRequests,
} from "@/lib/conversations/history-routing";
import {
  emptyThreadCache,
  holdsThread,
  recallThread,
  rememberThread,
  type CachedThread,
  type ThreadCache,
} from "@/lib/conversations/thread-cache";
import { adOriginOf } from "@/lib/conversations/ad-origin";
import { applyWindowReopened } from "@/lib/conversations/window-reopen";

import { hasUserDataCookie } from "@/lib/auth/client-cookies";
import { resolveAutomationEnabled } from "@/lib/conversations/automation";
import {
  applyWindowEvent,
  closeWindowConversation,
  clearWindowLoading,
  clearWindowSearch,
  emptyWindowConversations,
  incomingUnreadIds,
  markWindowLoadingHistory,
  openWindowConversation,
  patchWindowLead,
  setWindowVisibility,
  settleWindowHistory,
  startWindowSearch,
  unreadIdsIn,
  type OpenWindowConversationInput,
  type WindowConversations,
} from "@/lib/conversations/windowed-conversations";
import { MAX_OPEN_WINDOWS, windowKey } from "@/lib/conversations/window-deck";
import {
  emptyTyping,
  reduceTyping,
  type TypingState,
} from "@/lib/conversations/typing";
import { applyViewers, emptyViewers, forgetViewers, type ViewersState } from "@/lib/conversations/viewers";
import { readMessageCapabilities } from "@/lib/conversations/message-actions";
import { readMediaLimits } from "@/lib/conversations/attachment-rules";
import { readSenderKind } from "@/lib/conversations/sender";
import {
  messageActionErrorKey,
  messageCommand,
  noPendingMessageActions,
  pendingOf,
  settleMessageActions,
  takeRefusedMessageAction,
  trackMessageAction,
  type MessageActionRequest,
  type PendingMessageActions,
} from "@/lib/conversations/message-commands";
import { patchColumns, patchEntries } from "@/lib/conversations/entry-patch";
import { placeByRecency, placementFor } from "@/lib/conversations/inbox-placement";
import {
  leadPatchFromRecord,
  leadPresence,
  mergeSubscribedLead,
  patchLead,
  patchLeadColumns,
  patchLeadList,
  planLeadUpdate,
  subscribedLeadPatch,
  type CarrierFilter,
  type LeadCarrier,
  type LeadPatch,
  type LeadReread,
} from "@/lib/conversations/lead-patch";
import {
  subscribeAnswered,
  subscribeSent,
  subscribesDropped,
  type PendingSubscribe,
} from "@/lib/conversations/subscribe-ledger";
import { createLeadRefresher, type LeadFetched } from "@/lib/conversations/lead-refresh";
import { getLeadByIdAction } from "@/app/actions/leads";
import type { LeadsBulkUpdateEvent, LeadUpdateEvent } from "@/lib/leads/types";
import {
  createReconnectController,
  type ReconnectController,
} from "@/lib/ws/reconnect";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { isTemplateSendRefusal, outreachRefusalKey } from "@/lib/whatsapp-outreach/refusals";
import { useDepartment } from "@/contexts/department-context";
import { customerMessageArrived, customerMessageSignal } from "@/lib/attention/customer";
import { setViewing, signalAttention } from "@/lib/attention/signal";
import { emitTeamChat, emitTeamChatConnection, registerTeamChatTypingSender } from "@/lib/team-chat/bus";
import { readTeamChatEvent } from "@/lib/team-chat/types";
import { sendErrorKey } from "@/lib/conversations/send-errors";
import {
  applyToActive,
  applyToList,
  beginOperation,
  confirmOperation,
  emptyLedger,
  pendingOn,
  restoreActive,
  restoreList,
  rollbackOperation,
  snapshotViews,
  type OptimisticLedger,
  type ViewMembership,
  type ViewsSnapshot,
} from "@/lib/crm/optimistic";
import { toastUndo } from "@/lib/crm/undoable";
import { assigneeKind } from "@/lib/conversations/assignee";
import { useWorkspace } from "@/contexts/workspace-context";
import { emitNotificationCreated } from "@/lib/notifications/bus";
import { isNotificationCreatedEvent } from "@/lib/notifications/types";
import { usePersonalMarks, type PersonalInboxControls } from "@/hooks/use-personal-marks";
import { clearUnreadCounts } from "@/lib/conversations/entry-patch";
import type { MarkedEntry } from "@/lib/conversations/personal-marks";

export interface FunnelColumnState {
  entries: InboxEntry[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  loading: boolean;
}

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;

function newRequestId(): string {
  return crypto.randomUUID();
}

function withEntryStringDefaults(entry: InboxEntry): InboxEntry {
  return {
    ...entry,
    lead_name: entry.lead_name ?? "",
    lead_number: entry.lead_number ?? "",
    last_message_preview: entry.last_message_preview ?? "",
    last_message_type: entry.last_message_type ?? "user_message",
    last_message_sender: entry.last_message_sender ?? "",
    last_message_sender_avatar: entry.last_message_sender_avatar ?? "",
    last_message_sender_kind: readSenderKind(entry.last_message_sender_kind),
    business_phone_id: entry.business_phone_id ?? "",
  };
}

interface UseConversationWsOptions {
  token: string | null;
  campaignId?: string;
  campaignType?: CampaignType;
  enabled?: boolean;
}

export type { SendButtonWsInput };

const HISTORY_COMMAND: Record<Exclude<HistoryDirection, "latest">, string> = {
  before: "load_history",
  around: "load_around",
  after: "load_after",
};

const NO_HOLDERS: ReadonlySet<HistoryHolder> = new Set();

interface InboxView {
  campaignId: string;
  campaignType?: CampaignType;
  whatsAppCampaignType?: WhatsAppCampaignTypeFilter;
  containerKind?: ContainerKind;
  conversationStatus: string;
}

function switchViewPayload(view: InboxView): Record<string, string> {
  return {
    campaign_id: view.campaignId,
    campaign_type: view.campaignType ?? "",
    whatsapp_campaign_type: view.whatsAppCampaignType ?? "",
    container_kind: view.containerKind ?? "",
    conversation_status: view.conversationStatus,
  };
}

function isDefaultView(view: InboxView): boolean {
  return Object.values(switchViewPayload(view)).every((value) => value === "");
}

function sameView(a: InboxView, b: InboxView): boolean {
  const left = switchViewPayload(a);
  const right = switchViewPayload(b);
  return Object.keys(left).every((key) => left[key] === right[key]);
}

function historyPageOf(payload: WsHistoryPayload): HistoryPage {
  return {
    direction: payload.direction,
    messages: payload.messages ?? [],
    has_more: Boolean(payload.has_more),
    has_after: Boolean(payload.has_after),
    ...(payload.direction === "latest" || payload.direction === "around" ? { total: payload.total } : {}),
  };
}

function normalizeEventMessages(event: WsServerEvent): WsServerEvent {
  switch (event.type) {
    case "conversation:history":
    case "conversation:search_messages_results":
      return { ...event, payload: { ...event.payload, messages: (event.payload.messages ?? []).map(normalizeWireMessage) } } as WsServerEvent;
    case "conversation:message":
    case "conversation:message_sent":
    case "conversation:message_updated":
      return { ...event, payload: { ...event.payload, message: normalizeWireMessage(event.payload.message) } } as WsServerEvent;
    default:
      return event;
  }
}

function seededConversation(
  entryId: string,
  entryType: EntryType,
  entry: InboxEntry | undefined,
  thread: CachedThread,
): ActiveConversation {
  return {
    entry_id: entryId,
    entry_type: entryType,
    campaign_id: entry?.campaign_id,
    lead_id: entry?.lead_id,
    lead_version: entry?.lead_version,
    blocked: entry?.blocked,
    lead_name: entry?.lead_name ?? "",
    lead_picture: entry?.lead_picture,
    lead_number: entry?.lead_number ?? "",
    entry_variables: entry?.entry_variables ?? [],
    messages: thread.messages,
    has_more: thread.has_more,
    has_after: false,
    ...(thread.total !== undefined ? { total: thread.total } : {}),
    unread_count: entry?.unread_count ?? 0,
    window_open: entry?.window_open ?? false,
    window_expires_at: entry?.window_expires_at ?? null,
    ...readWindowClosed(entry ?? {}),
    automation_enabled: entry?.automation_enabled,
    conversation_status: entry?.conversation_status,
    is_group: entry?.is_group,
  };
}

export type LeadUpdateListener = (event: LeadUpdateEvent) => void;

export type LeadsBulkUpdateListener = (event: LeadsBulkUpdateEvent) => void;

export type ServerEventListener = (event: WsServerEvent) => void;

interface UseConversationWsReturn {
  status: ConnectionStatus;
  inbox: InboxEntry[];
  activeConversation: ActiveConversation | null;

  connectedUsers: ConnectedUser[];
  subscribe: (entryId: string, entryType: EntryType) => void;
  unsubscribe: () => void;
  sendMessage: (
    text: string,
    signed: boolean,
    replyToMessageId?: string,
  ) => void;
  sendMediaMessage: (
    text: string,
    mediaId: string,
    mediaType: MediaType,
    signed: boolean,
    replyToMessageId?: string,
  ) => void;
  sendButtonMessage: (
    input: SendButtonWsInput,
    replyToMessageId?: string,
  ) => void;
  markRead: (messageIds: string[]) => void;
  sendTyping: (isTyping: boolean) => void;
  typingByEntry: TypingState;
  totalUnread: number;
  loadHistory: () => void;
  loadingHistory: boolean;
  loadingConversation: boolean;
  loadAround: (anchor: HistoryAnchor) => void;
  loadNewer: () => void;
  returnToPresent: () => void;
  prefetchConversation: (entryId: string, entryType: EntryType) => void;
  outbox: Outbox;
  retrySend: (requestId: string) => void;
  resendMessage: (entryId: string, entryType: EntryType, messageId: string) => void;
  reopenWindow: (entryId: string, entryType: EntryType, templateId: string, parameters: string[]) => void;
  requestInboxPage: (page: number) => void;
  inboxHasMore: boolean;
  inboxTotalItems: number;
  inboxStageCounts: Record<string, number>;
  conversationStatusCounts: Record<string, number>;
  loadingInbox: boolean;
  searchInbox: (filters: WsSearchInboxPayload) => void;
  clearSearch: () => void;
  searchResults: InboxEntry[] | null;
  searching: boolean;
  searchTotalItems: number;
  searchTotalPages: number;
  searchPage: number;
  searchHasMore: boolean;
  requestSearchPage: (page: number) => void;
  loadingSearchMore: boolean;
  searchMessages: (query: string, page?: number) => void;
  clearMessageSearch: () => void;
  messageSearchResults: ConversationMessage[] | null;
  searchingMessages: boolean;
  messageSearchTotalItems: number;
  messageSearchTotalPages: number;
  messageSearchPage: number;
  messageSearchQuery: string | null;
  funnelColumns: Map<string, FunnelColumnState>;
  funnelSummary: Map<string, number>;
  loadingFunnelColumn: string | null;
  requestFunnelColumn: (
    stageId: string,
    page?: number,
    pageSize?: number,
  ) => void;
  requestFunnelSummary: (tagIds: string[]) => void;
  clearFunnelColumns: () => void;
  viewMode: ViewMode;
  switchView: (
    campaignId?: string,
    campaignType?: CampaignType,
    whatsappCampaignType?: WhatsAppCampaignTypeFilter,
    conversationStatus?: string,
    containerKind?: ContainerKind,
  ) => void;
  latestAnalysisUpdate: WsAnalysisUpdatePayload | null;
  assignTo: (entryId: string, entryType: string, userId: string) => void;
  forgetEntry: (entryId: string, entryType: EntryType) => void;
  setConversationStatus: (
    entryId: string,
    entryType: string,
    status: string,
    outcomeCode?: string,
  ) => void;
  pendingOutcomeRequest: PendingOutcomeRequest | null;
  clearPendingOutcomeRequest: () => void;
  applyLeadPatch: (leadId: string, patch: LeadPatch) => void;
  subscribeLeadUpdates: (listener: LeadUpdateListener) => () => void;
  subscribeLeadsBulkUpdates: (listener: LeadsBulkUpdateListener) => () => void;
  subscribeServerEvents: (listener: ServerEventListener) => () => void;
  viewersByEntry: ViewersState;
  runMessageAction: (request: MessageActionRequest) => boolean;

  windowConversations: WindowConversations;
  windowFocusRequest: { key: string; nonce: number } | null;
  openConversationWindow: (input: OpenWindowConversationInput) => void;
  closeConversationWindow: (entryId: string, entryType: EntryType) => void;
  setConversationWindowVisible: (
    entryId: string,
    entryType: EntryType,
    visible: boolean,
  ) => void;
  windowSendMessage: (
    entryId: string,
    entryType: EntryType,
    text: string,
    signed: boolean,
    replyToMessageId?: string,
  ) => void;
  windowSendMedia: (
    entryId: string,
    entryType: EntryType,
    text: string,
    mediaId: string,
    mediaType: MediaType,
    signed: boolean,
    replyToMessageId?: string,
  ) => void;
  windowSendButton: (
    entryId: string,
    entryType: EntryType,
    input: SendButtonWsInput,
    replyToMessageId?: string,
  ) => void;
  windowSendTyping: (
    entryId: string,
    entryType: EntryType,
    isTyping: boolean,
  ) => void;
  windowLoadHistory: (entryId: string, entryType: EntryType) => void;
  windowSearchMessages: (entryId: string, entryType: EntryType, query: string) => void;
  windowClearMessageSearch: (entryId: string, entryType: EntryType) => void;
  windowLoadAround: (entryId: string, entryType: EntryType, anchor: HistoryAnchor) => void;
  windowLoadNewer: (entryId: string, entryType: EntryType) => void;
  windowReturnToPresent: (entryId: string, entryType: EntryType) => void;
  personalInbox: PersonalInboxControls;
}

export function useConversationWs({
  token,
  campaignId = "",
  campaignType,
  enabled = true,
}: UseConversationWsOptions): UseConversationWsReturn {
  const { currentWorkspace, can } = useWorkspace();
  const { currentDepartment } = useDepartment();
  const tOutreach = useTranslations("whatsappOutreach");
  const tSendError = useTranslations("crmConversation.sendError");
  const tActions = useTranslations("crmActions");
  const tMessageAction = useTranslations("crmMessage.actionError");
  const canReadLeads = can("leads", "read");
  const workspaceId = currentWorkspace?.id ?? "";
  const departmentId = currentDepartment?.id ?? "";
  const scopeKey = `${workspaceId}:${departmentId}`;
  const [viewMode, setViewMode] = useState<ViewMode>(
    campaignId ? "campaign" : "global",
  );
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [inbox, setInbox] = useState<InboxEntry[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<ActiveConversation | null>(null);
  const [typingByEntry, setTypingByEntry] = useState<TypingState>(emptyTyping);
  const [viewersByEntry, setViewersByEntry] = useState<ViewersState>(emptyViewers);
  const pendingMessageActionsRef = useRef<PendingMessageActions>(noPendingMessageActions);
  const serverEventListenersRef = useRef(new Set<ServerEventListener>());
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const loadingConversationTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const stopLoadingConversation = useCallback(() => {
    if (loadingConversationTimerRef.current) {
      clearTimeout(loadingConversationTimerRef.current);
      loadingConversationTimerRef.current = null;
    }
    setLoadingConversation(false);
  }, []);
  const [outbox, setOutbox] = useState<Outbox>(emptyOutbox);
  const outboxRef = useRef<Outbox>(emptyOutbox);
  const historyRequestsRef = useRef<HistoryRequests>(noHistoryRequests);
  const threadCacheRef = useRef<ThreadCache>(emptyThreadCache);
  const scopeKeyRef = useRef(scopeKey);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxTotalPages, setInboxTotalPages] = useState(1);
  const [inboxTotalItems, setInboxTotalItems] = useState(0);
  const [inboxStageCounts, setInboxStageCounts] = useState<
    Record<string, number>
  >({});
  const [conversationStatusCounts, setConversationStatusCounts] = useState<
    Record<string, number>
  >({});
  const [pendingOutcomeRequest, setPendingOutcomeRequest] =
    useState<PendingOutcomeRequest | null>(null);

  const [searchResults, setSearchResults] = useState<InboxEntry[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchTotalItems, setSearchTotalItems] = useState(0);
  const [searchTotalPages, setSearchTotalPages] = useState(0);
  const [searchPageNum, setSearchPageNum] = useState(1);
  const [currentSearchFilters, setCurrentSearchFilters] =
    useState<WsSearchInboxPayload | null>(null);
  const [loadingSearchMore, setLoadingSearchMore] = useState(false);

  const [messageSearchResults, setMessageSearchResults] = useState<
    ConversationMessage[] | null
  >(null);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [messageSearchTotalItems, setMessageSearchTotalItems] = useState(0);
  const [messageSearchTotalPages, setMessageSearchTotalPages] = useState(0);
  const [messageSearchPageNum, setMessageSearchPageNum] = useState(1);
  const [messageSearchQuery, setMessageSearchQuery] = useState<string | null>(
    null,
  );
  const paneSearchRef = useRef<{ entry_id: string; entry_type: EntryType; query: string } | null>(null);

  const [funnelColumns, setFunnelColumns] = useState<
    Map<string, FunnelColumnState>
  >(new Map());
  const [funnelSummary, setKanbanSummary] = useState<Map<string, number>>(
    new Map(),
  );
  const [loadingFunnelColumn, setLoadingKanbanColumn] = useState<string | null>(
    null,
  );

  const [latestAnalysisUpdate, setLatestAnalysisUpdate] =
    useState<WsAnalysisUpdatePayload | null>(null);

  const [windowConversations, setWindowConversations] =
    useState<WindowConversations>(emptyWindowConversations);
  const windowConversationsRef = useRef<WindowConversations>(
    windowConversations,
  );
  const [windowFocusRequest, setWindowFocusRequest] = useState<{
    key: string;
    nonce: number;
  } | null>(null);
  const windowFocusNonceRef = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const controllerRef = useRef<ReconnectController | null>(null);
  const everConnectedRef = useRef(false);
  const activeSubscriptionRef = useRef<{
    entry_id: string;
    entry_type: EntryType;
  } | null>(null);
  const inboxRef = useRef<InboxEntry[]>([]);
  const currentSearchFiltersRef = useRef<WsSearchInboxPayload | null>(null);
  const searchResultsRef = useRef<InboxEntry[] | null>(null);
  const activeConversationRef = useRef<ActiveConversation | null>(null);
  const funnelColumnsRef = useRef<Map<string, FunnelColumnState>>(funnelColumns);
  const canReadLeadsRef = useRef(canReadLeads);
  const statusLedgerRef = useRef<OptimisticLedger<ViewsSnapshot>>(emptyLedger());
  const assignmentLedgerRef = useRef<
    OptimisticLedger<{ previous: string; requested: string }>
  >(emptyLedger());

  const intentionalDisconnectRef = useRef(false);
  const isConnectingRef = useRef(false);
  const connectionParamsRef = useRef({
    token,
    campaignId,
    campaignType,
    enabled,
    workspaceId,
    departmentId,
  });
  const connectRef = useRef<(() => void) | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createReconnectController({
      connect: () => connectRef.current?.(),
      shouldReconnect: () =>
        connectionParamsRef.current.enabled &&
        !intentionalDisconnectRef.current &&
        hasUserDataCookie(),
      baseDelayMs: RECONNECT_BASE_DELAY,
      maxDelayMs: RECONNECT_MAX_DELAY,
    });
  }
  const prevScopeKeyRef = useRef(scopeKey);
  const currentViewRef = useRef<InboxView>({
    campaignId,
    campaignType,
    whatsAppCampaignType: undefined,
    conversationStatus: "",
  });

  useEffect(() => {
    connectionParamsRef.current = {
      token,
      campaignId,
      campaignType,
      enabled,
      workspaceId,
      departmentId,
    };
  }, [token, campaignId, campaignType, enabled, workspaceId, departmentId]);

  useEffect(() => {
    currentSearchFiltersRef.current = currentSearchFilters;
  }, [currentSearchFilters]);

  useEffect(() => {
    searchResultsRef.current = searchResults;
  }, [searchResults]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
    setViewing("customer_message", activeConversation?.entry_id ?? null);
  }, [activeConversation]);

  useEffect(() => {
    funnelColumnsRef.current = funnelColumns;
  }, [funnelColumns]);

  useEffect(() => {
    canReadLeadsRef.current = canReadLeads;
  }, [canReadLeads]);

  const statusMembership = useCallback((): ViewMembership => {
    const inboxStatus = currentViewRef.current.conversationStatus;
    const searchStatus = currentSearchFiltersRef.current?.conversation_status;
    return {
      inbox: (entry) => !inboxStatus || entry.conversation_status === inboxStatus,
      search: (entry) => !searchStatus || entry.conversation_status === searchStatus,
    };
  }, []);

  const settleStatusChange = useCallback((entryId: string, entryType: string) => {
    const pending = pendingOn(statusLedgerRef.current, windowKey(entryId, entryType));
    if (!pending) return;
    statusLedgerRef.current = confirmOperation(statusLedgerRef.current, pending.id).ledger;
  }, []);

  const rollbackPendingStatusChange = useCallback(
    (entryId: string, entryType: string, previousStatus?: string) => {
      const pending = pendingOn(statusLedgerRef.current, windowKey(entryId, entryType));
      if (!pending) return;
      const { ledger, snapshot } = rollbackOperation(statusLedgerRef.current, pending.id);
      statusLedgerRef.current = ledger;
      if (!snapshot) return;

      const target = { entryId, entryType };
      const membership = statusMembership();
      const correction = previousStatus ? { conversation_status: previousStatus } : undefined;

      setInbox((prev) => {
        const restored = restoreList(prev, target, snapshot.inbox, membership.inbox, correction);
        inboxRef.current = restored;
        return restored;
      });
      setSearchResults((prev) =>
        prev && restoreList(prev, target, snapshot.search, membership.search, correction),
      );
      setActiveConversation((prev) =>
        restoreActive(prev, target, snapshot.active, correction),
      );
    },
    [statusMembership],
  );

  useEffect(() => {
    scopeKeyRef.current = scopeKey;
    if (prevScopeKeyRef.current && prevScopeKeyRef.current !== scopeKey) {
      setFunnelColumns(new Map());
      setKanbanSummary(new Map());
      setLoadingKanbanColumn(null);
      setInbox([]);
      inboxRef.current = [];
      setInboxPage(1);
      setInboxTotalPages(1);
      setInboxTotalItems(0);
      setInboxStageCounts({});
      setConversationStatusCounts({});
      setSearchResults(null);
      setMessageSearchResults(null);
      setMessageSearchQuery(null);
      currentViewRef.current = {
        campaignId: "",
        campaignType: undefined,
        whatsAppCampaignType: undefined,
        conversationStatus: "",
      };
    }
    prevScopeKeyRef.current = scopeKey;
  }, [scopeKey]);


  const send = useCallback((type: string, payload: Record<string, unknown>): boolean => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return false;
    wsRef.current.send(JSON.stringify({ type, payload }));
    return true;
  }, []);

  useEffect(
    () => registerTeamChatTypingSender((threadId) => send("team_chat_typing", { thread_id: threadId })),
    [send],
  );

  useEffect(() => {
    emitTeamChatConnection(status === "connected");
  }, [status]);

  const commitOutbox = useCallback((next: Outbox) => {
    if (next === outboxRef.current) return;
    outboxRef.current = next;
    setOutbox(next);
  }, []);

  const dispatchOutboxItem = useCallback(
    (item: OutboxItem) => {
      const command = outboxCommand(item);
      send(command.type, command.payload);
    },
    [send],
  );

  const settleOutboxWith = useCallback(
    (messages: readonly ConversationMessage[]) => {
      commitOutbox(settleDelivered(outboxRef.current, messages));
    },
    [commitOutbox],
  );

  const requestPage = useCallback(
    (
      holder: HistoryHolder,
      entryId: string,
      entryType: EntryType,
      direction: Exclude<HistoryDirection, "latest">,
      payload: Record<string, unknown>,
    ): boolean => {
      if (!send(HISTORY_COMMAND[direction], payload)) return false;
      historyRequestsRef.current = requestHistory(
        historyRequestsRef.current,
        windowKey(entryId, entryType),
        direction,
        holder,
      );
      return true;
    },
    [send],
  );

  const personalMarks = usePersonalMarks({ send });

  const subscribesInFlightRef = useRef<Map<string, PendingSubscribe>>(new Map());

  const settleSubscribes = useCallback((key: string, pending: PendingSubscribe | undefined) => {
    if (pending) subscribesInFlightRef.current.set(key, pending);
    else subscribesInFlightRef.current.delete(key);
  }, []);

  const sendSubscribe = useCallback(
    (entryId: string, entryType: EntryType, reread?: LeadReread) => {
      if (!send("subscribe", { entry_id: entryId, entry_type: entryType })) return;
      const key = windowKey(entryId, entryType);
      settleSubscribes(key, subscribeSent(subscribesInFlightRef.current.get(key), reread));
    },
    [send, settleSubscribes],
  );

  const dropSubscribesInFlight = useCallback(() => {
    for (const [key, pending] of [...subscribesInFlightRef.current]) {
      settleSubscribes(key, subscribesDropped(pending));
    }
  }, [settleSubscribes]);

  type SubscriptionHolder = "pane" | "window";
  const subscriptionHoldersRef = useRef<
    Map<
      string,
      { entryId: string; entryType: EntryType; holders: Set<SubscriptionHolder> }
    >
  >(new Map());

  const sendAssign = useCallback(
    (entryId: string, entryType: string, userId: string) => {
      send("assign_to", {
        entry_id: entryId,
        entry_type: entryType,
        user_id: userId,
      });
    },
    [send],
  );

  const offerAssignmentUndo = useCallback(
    (entryId: string, entryType: string, assignedUserId: string | undefined) => {
      const pending = pendingOn(assignmentLedgerRef.current, windowKey(entryId, entryType));
      if (!pending || pending.snapshot.requested !== assignedUserId) return;
      assignmentLedgerRef.current = confirmOperation(assignmentLedgerRef.current, pending.id).ledger;
      toastUndo(
        {
          inverse: () => sendAssign(entryId, entryType, pending.snapshot.previous),
          labelKey: "assigned",
        },
        tActions,
      );
    },
    [sendAssign, tActions],
  );

  const forgetTyping = useCallback((entryId: string, entryType: EntryType) => {
    setTypingByEntry((prev) =>
      reduceTyping(prev, { type: "entry_left", entryId, entryType }),
    );
  }, []);

  const retainSubscription = useCallback(
    (entryId: string, entryType: EntryType, holder: SubscriptionHolder) => {
      const key = windowKey(entryId, entryType);
      const current = subscriptionHoldersRef.current.get(key);
      const holders = current?.holders ?? new Set<SubscriptionHolder>();
      holders.add(holder);
      subscriptionHoldersRef.current.set(key, { entryId, entryType, holders });

      sendSubscribe(entryId, entryType);
    },
    [sendSubscribe],
  );

  const releaseSubscription = useCallback(
    (entryId: string, entryType: EntryType, holder: SubscriptionHolder) => {
      const key = windowKey(entryId, entryType);
      const current = subscriptionHoldersRef.current.get(key);
      if (!current) return;

      current.holders.delete(holder);
      if (current.holders.size > 0) return;

      subscriptionHoldersRef.current.delete(key);
      send("unsubscribe", { entry_id: entryId, entry_type: entryType });
      forgetTyping(entryId, entryType);
    },
    [send, forgetTyping],
  );

  const patchListedLead = useCallback(
    (leadId: string, patch: LeadPatch, only?: CarrierFilter<InboxEntry>) => {
      setInbox((prev) => {
        const updated = patchLeadList(prev, leadId, patch, only);
        inboxRef.current = updated;
        return updated;
      });
      setSearchResults((prev) => {
        if (!prev) return prev;
        const updated = patchLeadList(prev, leadId, patch, only);
        searchResultsRef.current = updated;
        return updated;
      });
      setFunnelColumns((prev) => patchLeadColumns(prev, leadId, patch, only));
    },
    [],
  );

  const applyConversationLead = useCallback(
    (entryId: string, entryType: EntryType, leadId: string, patch: LeadPatch) => {
      patchListedLead(leadId, patch, (entry) => entry.entry_id === entryId && entry.entry_type === entryType);
    },
    [patchListedLead],
  );

  const applyLeadPatch = useCallback((leadId: string, patch: LeadPatch) => {
    if (!leadId) return;

    patchListedLead(leadId, patch);
    setActiveConversation((prev) => (prev ? patchLead(prev, leadId, patch) : prev));

    const windows = patchWindowLead(windowConversationsRef.current, leadId, patch);
    if (windows !== windowConversationsRef.current) {
      windowConversationsRef.current = windows;
      setWindowConversations(windows);
    }
  }, [patchListedLead]);

  const openLeadConversations = useCallback((): (ActiveConversation | null)[] => {
    const windows = [...windowConversationsRef.current.values()].map((w) => w.conversation);
    return [activeConversationRef.current, ...windows];
  }, []);

  const shownLeadCarriers = useCallback((): (LeadCarrier | null)[] => {
    const columns = [...funnelColumnsRef.current.values()].flatMap((column) => column.entries);
    return [
      ...inboxRef.current,
      ...(searchResultsRef.current ?? []),
      ...columns,
      ...openLeadConversations(),
    ];
  }, [openLeadConversations]);

  const rereadLeadConversations = useCallback(
    (leadId: string, fields: readonly string[]) => {
      const reread = new Set<string>();
      for (const conversation of openLeadConversations()) {
        if (!conversation || conversation.lead_id !== leadId) continue;
        const key = windowKey(conversation.entry_id, conversation.entry_type);
        if (reread.has(key) || !subscriptionHoldersRef.current.has(key)) continue;
        reread.add(key);
        sendSubscribe(conversation.entry_id, conversation.entry_type, { leadId, fields });
      }
    },
    [openLeadConversations, sendSubscribe],
  );

  const vouchSubscribed = useCallback((event: WsServerEvent): WsServerEvent => {
    if (event.type !== "conversation:subscribed") return event;
    const key = windowKey(event.payload.entry_id, event.payload.entry_type);
    const settled = subscribeAnswered(subscribesInFlightRef.current.get(key), event.payload);
    settleSubscribes(key, settled.pending);
    return { ...event, payload: settled.answer };
  }, [settleSubscribes]);

  const fetchShownLead = useCallback(
    async (leadId: string, fields: readonly string[]): Promise<LeadFetched | null> => {
      if (!canReadLeadsRef.current) {
        rereadLeadConversations(leadId, fields);
        return null;
      }
      const { lead } = await getLeadByIdAction(leadId);
      if (!lead) return null;
      const applyFields = (named: readonly string[]) => applyLeadPatch(leadId, leadPatchFromRecord(lead, named));
      applyFields(fields);
      return { version: lead.version, applyFields };
    },
    [applyLeadPatch, rereadLeadConversations],
  );

  const leadRefresherRef = useRef<((event: LeadUpdateEvent) => void) | null>(null);
  const subscribeServerEvents = useCallback((listener: ServerEventListener) => {
    serverEventListenersRef.current.add(listener);
    return () => {
      serverEventListenersRef.current.delete(listener);
    };
  }, []);

  const leadUpdateListenersRef = useRef(new Set<LeadUpdateListener>());

  const subscribeLeadUpdates = useCallback((listener: LeadUpdateListener) => {
    leadUpdateListenersRef.current.add(listener);
    return () => {
      leadUpdateListenersRef.current.delete(listener);
    };
  }, []);

  const leadsBulkListenersRef = useRef(new Set<LeadsBulkUpdateListener>());

  const subscribeLeadsBulkUpdates = useCallback((listener: LeadsBulkUpdateListener) => {
    leadsBulkListenersRef.current.add(listener);
    return () => {
      leadsBulkListenersRef.current.delete(listener);
    };
  }, []);

  const handleLeadsBulkUpdate = useCallback((event: LeadsBulkUpdateEvent) => {
    if (typeof event?.runId !== "string" || event.runId === "") return;
    const notice: LeadsBulkUpdateEvent = { runId: event.runId };
    for (const listener of leadsBulkListenersRef.current) listener(notice);
  }, []);

  const handleLeadUpdate = useCallback(
    (event: LeadUpdateEvent) => {
      if (typeof event?.leadId !== "string" || !Array.isArray(event.fields)) return;
      const notice: LeadUpdateEvent = { leadId: event.leadId, version: event.version, fields: event.fields };
      for (const listener of leadUpdateListenersRef.current) listener(notice);
      const plan = planLeadUpdate(leadPresence(shownLeadCarriers(), event.leadId), event);
      if (plan === "advance") applyLeadPatch(event.leadId, { lead_version: event.version });
      if (plan !== "refetch") return;
      leadRefresherRef.current ??= createLeadRefresher(fetchShownLead);
      leadRefresherRef.current(event);
    },
    [applyLeadPatch, fetchShownLead, shownLeadCarriers],
  );


  const normalizeEntry = useCallback(
    (raw: Record<string, unknown>): InboxEntry | null => {
      const entryType = raw.entry_type ?? raw.entryType;
      if (typeof entryType !== "string" || !isEntryType(entryType)) return null;
      return {
        entry_id: (raw.entry_id as string) ?? (raw.entryId as string) ?? "",
        entry_type: entryType,
        lead_id:
          (raw.lead_id as string) ?? (raw.leadId as string) ?? undefined,
        lead_version:
          (raw.lead_version as number) ?? (raw.leadVersion as number) ?? undefined,
        lead_name: (raw.lead_name as string) ?? (raw.leadName as string) ?? "",
        lead_number:
          (raw.lead_number as string) ?? (raw.leadNumber as string) ?? "",
        lead_picture:
          (raw.lead_picture as string) ??
          (raw.leadPicture as string) ??
          undefined,
        is_group: (raw.is_group as boolean) ?? (raw.isGroup as boolean) ?? false,
        blocked: (raw.blocked as boolean) ?? false,
        entry_variables:
          (raw.entry_variables as string[]) ??
          (raw.entryVariables as string[]) ??
          [],
        unread_count:
          (raw.unread_count as number) ?? (raw.unreadCount as number) ?? 0,
        last_message_preview:
          (raw.last_message_preview as string) ??
          (raw.lastMessagePreview as string) ??
          "",
        last_message_at:
          (raw.last_message_at as string) ??
          (raw.lastMessageAt as string) ??
          "",
        last_message_type:
          (raw.last_message_type as InboxEntry["last_message_type"]) ??
          (raw.lastMessageType as InboxEntry["last_message_type"]) ??
          "user_message",
        last_message_sender:
          (raw.last_message_sender as string) ??
          (raw.lastMessageSender as string) ??
          "",
        last_message_sender_avatar:
          (raw.last_message_sender_avatar as string) ??
          (raw.lastMessageSenderAvatar as string) ??
          "",
        last_message_sender_kind: readSenderKind(raw.last_message_sender_kind ?? raw.lastMessageSenderKind),
        last_message_author:
          (raw.last_message_author as string) ??
          (raw.lastMessageAuthor as string) ??
          undefined,
        last_message_from_us:
          (raw.last_message_from_us as boolean) ??
          (raw.lastMessageFromUs as boolean) ??
          false,
        window_open:
          (raw.window_open as boolean) ?? (raw.windowOpen as boolean) ?? false,
        window_expires_at:
          (raw.window_expires_at as string | null) ??
          (raw.windowExpiresAt as string | null) ??
          null,
        ...readWindowClosed(raw),
        business_phone_id:
          (raw.business_phone_id as string) ??
          (raw.businessPhoneId as string) ??
          "",
        stage: (raw.stage as InboxEntry["stage"]) ?? null,
        automation_enabled:
          (raw.automation_enabled as boolean | null) ??
          (raw.automationEnabled as boolean | null) ??
          null,
        matched_messages:
          (raw.matched_messages as InboxEntry["matched_messages"]) ??
          (raw.matchedMessages as InboxEntry["matched_messages"]),
        total_matches:
          (raw.total_matches as number) ?? (raw.totalMatches as number) ?? 0,
        campaign_id:
          (raw.campaign_id as string) ??
          (raw.campaignId as string) ??
          undefined,
        campaign_name:
          (raw.campaign_name as string) ??
          (raw.campaignName as string) ??
          undefined,
        labels: (raw.labels as InboxEntry["labels"]) ?? undefined,
        assigned_user_id:
          (raw.assigned_user_id as string) ??
          (raw.assignedUserId as string) ??
          undefined,
        assigned_username:
          (raw.assigned_username as string) ??
          (raw.assignedUsername as string) ??
          undefined,
        latest_analysis:
          (raw.latest_analysis as InboxEntry["latest_analysis"]) ??
          (raw.latestAnalysis as InboxEntry["latest_analysis"]) ??
          undefined,
        analysis_phase:
          (raw.analysis_phase as InboxEntry["analysis_phase"]) ??
          (raw.analysisPhase as InboxEntry["analysis_phase"]) ??
          undefined,
        live_read: (raw.live_read as InboxEntry["live_read"]) ?? undefined,
        conversation_status:
          (raw.conversation_status as string) ??
          (raw.conversationStatus as string) ??
          undefined,
        available_stages:
          (raw.available_stages as InboxEntry["available_stages"]) ??
          (raw.availableStages as InboxEntry["available_stages"]) ??
          undefined,
        waiting_since: (raw.waiting_since as string) ?? undefined,
      };
    },
    [],
  );

  const rememberThreadOf = useCallback((thread: ActiveConversation | null | undefined) => {
    if (!thread) return;
    threadCacheRef.current = rememberThread(
      threadCacheRef.current,
      scopeKeyRef.current,
      windowKey(thread.entry_id, thread.entry_type),
      thread,
    );
  }, []);

  const routeEventToWindows = useCallback(
    (event: WsServerEvent, historyHolders: ReadonlySet<HistoryHolder>) => {
      if (windowConversationsRef.current.size === 0) return;
      if (event.type === "conversation:history" && !historyHolders.has("window")) return;

      let unreadIds: string[] = [];
      if (event.type === "conversation:history") unreadIds = incomingUnreadIds(event.payload.messages);
      if (event.type === "conversation:message") unreadIds = incomingUnreadIds([event.payload.message]);

      const before = windowConversationsRef.current;
      const next = applyWindowEvent(before, event);
      if (next !== before) {
        windowConversationsRef.current = next;
        setWindowConversations(next);

        if (next.size < before.size) {
          for (const [key, state] of before) {
            if (next.has(key)) continue;
            rememberThreadOf(state.conversation);
            releaseSubscription(
              state.conversation.entry_id,
              state.conversation.entry_type,
              "window",
            );
          }
        }
      }

      if (unreadIds.length === 0) return;
      const payload = event.payload as { entry_id: string; entry_type: EntryType };

      const holder = next.get(windowKey(payload.entry_id, payload.entry_type));
      if (!holder?.visible) return;

      send("mark_read", {
        entry_id: payload.entry_id,
        entry_type: payload.entry_type,
        message_ids: unreadIds,
      });
    },
    [rememberThreadOf, releaseSubscription, send],
  );

  const routeHistory = useCallback((event: WsServerEvent): ReadonlySet<HistoryHolder> => {
    if (event.type !== "conversation:history") return NO_HOLDERS;
    const routed = routeHistoryPage(
      historyRequestsRef.current,
      windowKey(event.payload.entry_id, event.payload.entry_type),
      event.payload.direction,
    );
    historyRequestsRef.current = routed.requests;
    return routed.holders;
  }, []);

  const isPaneEntry = useCallback(
    (entryId: string, entryType: string) =>
      activeSubscriptionRef.current?.entry_id === entryId &&
      activeSubscriptionRef.current?.entry_type === entryType,
    [],
  );

  const updatePaneThread = useCallback(
    (entryId: string, entryType: string, update: (thread: ActiveConversation) => ActiveConversation) => {
      setActiveConversation((prev) =>
        prev && prev.entry_id === entryId && prev.entry_type === entryType ? update(prev) : prev,
      );
    },
    [],
  );

  const keepPrefetched = useCallback(
    (entryId: string, entryType: EntryType, page: HistoryPage) => {
      const key = windowKey(entryId, entryType);
      if (isPaneEntry(entryId, entryType) || windowConversationsRef.current.has(key)) return;
      const empty: ThreadMessages = { messages: [], has_more: false };
      threadCacheRef.current = rememberThread(threadCacheRef.current, scopeKeyRef.current, key, applyHistoryPage(empty, page));
    },
    [isPaneEntry],
  );

  const failQueuedSend = useCallback(
    (requestId: string | undefined, code: string | undefined): boolean => {
      if (!requestId) return false;
      const { outbox: next, failed } = failSend(outboxRef.current, requestId, code ?? "");
      commitOutbox(next);
      return failed !== null;
    },
    [commitOutbox],
  );

  const forgetRefusedJump = useCallback(
    (entryId: string, entryType: EntryType) => {
      const key = windowKey(entryId, entryType);
      historyRequestsRef.current = forgetHistoryRequests(historyRequestsRef.current, key, "around");
      if (isPaneEntry(entryId, entryType)) setLoadingHistory(false);
      const settled = settleWindowHistory(windowConversationsRef.current, key);
      if (settled === windowConversationsRef.current) return;
      windowConversationsRef.current = settled;
      setWindowConversations(settled);
    },
    [isPaneEntry],
  );

  const handleServerEvent = useCallback(
    (incoming: WsServerEvent) => {
      const event = normalizeEventMessages(vouchSubscribed(incoming));
      for (const listener of serverEventListenersRef.current) listener(event);
      const historyHolders = routeHistory(event);
      routeEventToWindows(event, historyHolders);
      if (personalMarks.observe(event)) return;

      switch (event.type) {
        case "conversation:connected_users":
          const { users } = event.payload;

          setConnectedUsers(users);
          break;

        case "conversation:inbox": {
          const {
            entries,
            page,
            total_pages,
            total_items,
            stage_counts,
            conversation_status_counts,
          } = event.payload;
          setInboxPage(page);
          setInboxTotalPages(total_pages);
          if (total_items != null) setInboxTotalItems(total_items);
          if (stage_counts) setInboxStageCounts(stage_counts);
          if (conversation_status_counts)
            setConversationStatusCounts(conversation_status_counts);
          setLoadingInbox(false);
          const filled = entries.map(withEntryStringDefaults);
          if (page <= 1) {
            setInbox(filled);
            inboxRef.current = filled;
          } else {
            setInbox((prev) => {
              const existingIds = new Set(
                prev.map((e) => `${e.entry_type}-${e.entry_id}`),
              );
              const newEntries = filled.filter(
                (e) => !existingIds.has(`${e.entry_type}-${e.entry_id}`),
              );
              const updated = [...prev, ...newEntries];
              inboxRef.current = updated;
              return updated;
            });
          }
          break;
        }

        case "conversation:entry_update": {
          const updated = normalizeEntry(
            event.payload.entry as unknown as Record<string, unknown>,
          );
          if (!updated) break;
          offerAssignmentUndo(updated.entry_id, updated.entry_type, updated.assigned_user_id);
          if (!event.payload.silent) {
            const before = inboxRef.current.find(
              (e) => e.entry_id === updated.entry_id && e.entry_type === updated.entry_type,
            );
            if (customerMessageArrived(before, updated)) signalAttention(customerMessageSignal(updated));
          }
          const withLead = (old?: InboxEntry): InboxEntry =>
            updated.lead_id || !old?.lead_id
              ? updated
              : { ...updated, lead_id: old.lead_id };
          setInbox((prev) => {
            const activeStatusFilter =
              currentViewRef.current.conversationStatus;
            const oldEntry = prev.find(
              (e) =>
                e.entry_id === updated.entry_id &&
                e.entry_type === updated.entry_type,
            );
            const existed = !!oldEntry;
            const matchesActiveStatusFilter =
              !activeStatusFilter ||
              updated.conversation_status === activeStatusFilter;

            if (!matchesActiveStatusFilter) {
              if (!existed) {
                return prev;
              }

              const filtered = prev.filter(
                (e) =>
                  !(
                    e.entry_id === updated.entry_id &&
                    e.entry_type === updated.entry_type
                  ),
              );
              inboxRef.current = filtered;
              setInboxTotalItems((total) => Math.max(0, total - 1));
              return filtered;
            }

            const newInbox = placeByRecency(prev, withLead(oldEntry));
            inboxRef.current = newInbox;

            if (!existed) {
              setInboxTotalItems((prev) => prev + 1);
            }
            return newInbox;
          });
          setSearchResults((prev) => {
            if (!prev) return prev;

            const activeSearchStatus =
              currentSearchFiltersRef.current?.conversation_status;
            const oldSearchEntry = prev.find(
              (e) =>
                e.entry_id === updated.entry_id &&
                e.entry_type === updated.entry_type,
            );
            const existed = !!oldSearchEntry;
            const matchesActiveSearchStatus =
              !activeSearchStatus ||
              updated.conversation_status === activeSearchStatus;

            if (!matchesActiveSearchStatus) {
              if (!existed) return prev;
              return prev.filter(
                (e) =>
                  !(
                    e.entry_id === updated.entry_id &&
                    e.entry_type === updated.entry_type
                  ),
              );
            }

            if (!existed) return prev;
            const place = placementFor(currentSearchFiltersRef.current?.sort);
            return place(prev, withLead(oldSearchEntry));
          });

          if (
            activeSubscriptionRef.current?.entry_id === updated.entry_id &&
            activeSubscriptionRef.current?.entry_type === updated.entry_type
          ) {
            setActiveConversation((prev) =>
              prev
                ? {
                    ...prev,
                    campaign_id: updated.campaign_id ?? prev.campaign_id,
                    window_open: updated.window_open,
                    window_expires_at: updated.window_expires_at,
                    entry_variables:
                      updated.entry_variables ?? prev.entry_variables,
                    automation_enabled:
                      updated.automation_enabled ?? prev.automation_enabled,
                    conversation_status:
                      updated.conversation_status ?? prev.conversation_status,
                  }
                : null,
            );
          }
          setFunnelColumns((prev) => {
            let changed = false;
            const newMap = new Map<string, FunnelColumnState>();
            for (const [stageId, colState] of prev) {
              if (!colState?.entries) {
                newMap.set(stageId, colState);
                continue;
              }
              const hasEntry = colState.entries.some(
                (e) =>
                  e.entry_id === updated.entry_id &&
                  e.entry_type === updated.entry_type,
              );
              if (hasEntry) {
                changed = true;
                newMap.set(stageId, {
                  ...colState,
                  entries: colState.entries.map((e) =>
                    e.entry_id === updated.entry_id &&
                    e.entry_type === updated.entry_type
                      ? updated
                      : e,
                  ),
                });
              } else {
                newMap.set(stageId, colState);
              }
            }
            return changed ? newMap : prev;
          });
          break;
        }

        case "conversation:conversation_status_update": {
          const {
            entry_id,
            entry_type,
            status,
            close_source,
            close_reason,
            close_outcome,
            closed_at,
          } = event.payload;
          const closePatch = {
            conversation_status: status,
            ...(close_source !== undefined ? { close_source } : {}),
            ...(close_reason !== undefined ? { close_reason } : {}),
            ...(close_outcome !== undefined ? { close_outcome } : {}),
            ...(closed_at !== undefined ? { closed_at } : {}),
          };
          setInbox((prev) => {
            const idx = prev.findIndex(
              (e) => e.entry_id === entry_id && e.entry_type === entry_type,
            );
            if (idx < 0) return prev;

            const activeStatusFilter =
              currentViewRef.current.conversationStatus;
            if (activeStatusFilter && status !== activeStatusFilter) {
              const filtered = prev.filter(
                (e) =>
                  !(e.entry_id === entry_id && e.entry_type === entry_type),
              );
              inboxRef.current = filtered;
              setInboxTotalItems((total) => Math.max(0, total - 1));
              return filtered;
            }

            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...closePatch };
            inboxRef.current = updated;
            return updated;
          });
          setSearchResults((prev) => {
            if (!prev) return prev;

            const idx = prev.findIndex(
              (e) => e.entry_id === entry_id && e.entry_type === entry_type,
            );
            if (idx < 0) return prev;

            const activeSearchStatus =
              currentSearchFiltersRef.current?.conversation_status;
            if (activeSearchStatus && status !== activeSearchStatus) {
              return prev.filter(
                (e) =>
                  !(e.entry_id === entry_id && e.entry_type === entry_type),
              );
            }

            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...closePatch };
            return updated;
          });
          setActiveConversation((prev) =>
            prev && prev.entry_id === entry_id && prev.entry_type === entry_type
              ? { ...prev, ...closePatch }
              : prev,
          );
          settleStatusChange(entry_id, entry_type);
          break;
        }

        case "conversation:conversation_status_counts_update": {
          setConversationStatusCounts(event.payload.counts ?? {});
          break;
        }

        case "conversation:entry_removed": {
          const { entry_id, entry_type } = event.payload;
          setInbox((prev) => {
            const existed = prev.some(
              (e) => e.entry_id === entry_id && e.entry_type === entry_type,
            );
            if (!existed) return prev;
            const filtered = prev.filter(
              (e) => !(e.entry_id === entry_id && e.entry_type === entry_type),
            );
            inboxRef.current = filtered;
            setInboxTotalItems((t) => Math.max(0, t - 1));
            return filtered;
          });
          setFunnelColumns((prev) => {
            let changed = false;
            const newMap = new Map<string, FunnelColumnState>();
            for (const [stageId, colState] of prev) {
              if (!colState?.entries) {
                newMap.set(stageId, colState);
                continue;
              }
              const before = colState.entries.length;
              const filtered = colState.entries.filter(
                (e) =>
                  !(e.entry_id === entry_id && e.entry_type === entry_type),
              );
              if (filtered.length < before) {
                changed = true;
                newMap.set(stageId, {
                  ...colState,
                  entries: filtered,
                  totalItems: Math.max(
                    0,
                    colState.totalItems - (before - filtered.length),
                  ),
                });
              } else {
                newMap.set(stageId, colState);
              }
            }
            return changed ? newMap : prev;
          });
          setKanbanSummary((prev) => {
            const newSummary = new Map(prev);
            return newSummary;
          });
          setSearchResults((prev) =>
            prev
              ? prev.filter(
                  (e) => !(e.entry_id === entry_id && e.entry_type === entry_type),
                )
              : prev,
          );
          if (
            activeSubscriptionRef.current?.entry_id === entry_id &&
            activeSubscriptionRef.current?.entry_type === entry_type
          ) {
            setActiveConversation(null);
            activeSubscriptionRef.current = null;
            stopLoadingConversation();
          }
          break;
        }

        case "conversation:subscribed": {
          const {
            entry_id,
            entry_type,
            lead_id,
            lead_version,
            lead_name,
            lead_number,
            lead_metadata,
            unread_count,
            window_open,
            window_expires_at,
            window_tier,
            automation_enabled,
            ad_origin,
          } = event.payload;
          const adOrigin = adOriginOf(ad_origin);
          const messageCapabilities = readMessageCapabilities(event.payload.message_capabilities);
          const mediaLimits = readMediaLimits(event.payload.media_limits);
          const leadPatch = subscribedLeadPatch(event.payload);

          if (lead_id && leadPatch) {
            applyConversationLead(entry_id, entry_type, lead_id, leadPatch);
          }

          if (
            activeSubscriptionRef.current &&
            (activeSubscriptionRef.current.entry_id !== entry_id ||
              activeSubscriptionRef.current.entry_type !== entry_type)
          ) {
            break;
          }

          const inboxEntry = inboxRef.current.find(
            (e) => e.entry_id === entry_id && e.entry_type === entry_type,
          );

          activeSubscriptionRef.current = { entry_id, entry_type };

          setActiveConversation((prev) => {
            if (
              prev &&
              prev.entry_id === entry_id &&
              prev.entry_type === entry_type &&
              prev.messages.length > 0
            ) {
              return mergeSubscribedLead({
                ...prev,
                lead_id: inboxEntry?.lead_id ?? prev.lead_id,
                blocked: inboxEntry?.blocked ?? prev.blocked,
                lead_metadata: lead_metadata ?? prev.lead_metadata,
                campaign_id: inboxEntry?.campaign_id ?? prev.campaign_id,
                entry_variables:
                  inboxEntry?.entry_variables ?? prev.entry_variables,
                unread_count: unread_count ?? prev.unread_count,
                window_open:
                  window_open ?? inboxEntry?.window_open ?? prev.window_open,
                window_expires_at:
                  window_expires_at ??
                  inboxEntry?.window_expires_at ??
                  prev.window_expires_at,
                ...mergeWindowClosed(event.payload, prev),
                window_tier: window_tier ?? null,
                automation_enabled: resolveAutomationEnabled(
                  automation_enabled,
                  inboxEntry?.automation_enabled,
                  prev.automation_enabled,
                ),
                conversation_status:
                  inboxEntry?.conversation_status ?? prev.conversation_status,
                ad_origin: adOrigin ?? prev.ad_origin ?? null,
                message_capabilities: messageCapabilities ?? prev.message_capabilities,
                media_limits: mediaLimits,
              }, event.payload);
            }

            return {
              entry_id,
              entry_type,
              campaign_id: inboxEntry?.campaign_id,
              lead_id: lead_id ?? inboxEntry?.lead_id,
              lead_version: lead_version ?? inboxEntry?.lead_version,
              blocked: leadPatch?.blocked ?? inboxEntry?.blocked,
              lead_name,
              lead_number,
              lead_metadata,
              entry_variables: inboxEntry?.entry_variables ?? [],
              messages: [],
              has_more: false,
              unread_count,
              window_open: window_open ?? inboxEntry?.window_open ?? false,
              window_expires_at:
                window_expires_at ?? inboxEntry?.window_expires_at ?? null,
              ...mergeWindowClosed(event.payload, inboxEntry ?? {}),
              window_tier: window_tier ?? null,
              automation_enabled: resolveAutomationEnabled(
                automation_enabled,
                inboxEntry?.automation_enabled,
              ),
              conversation_status: inboxEntry?.conversation_status,
              ad_origin: adOrigin,
              message_capabilities: messageCapabilities,
              media_limits: mediaLimits,
            };
          });

          break;
        }

        case "conversation:ad_origin": {
          const { entry_id, entry_type } = event.payload;
          const adOrigin = adOriginOf(event.payload.ad_origin);
          setActiveConversation((prev) =>
            prev && prev.entry_id === entry_id && prev.entry_type === entry_type
              ? { ...prev, ad_origin: adOrigin }
              : prev,
          );
          break;
        }

        case "conversation:history": {
          const { entry_id, entry_type } = event.payload;
          const page = historyPageOf(event.payload);
          settleOutboxWith(page.messages);
          if (historyHolders.has("prefetch")) keepPrefetched(entry_id, entry_type, page);
          if (!historyHolders.has("pane") || !isPaneEntry(entry_id, entry_type)) break;

          setLoadingHistory(false);
          stopLoadingConversation();
          updatePaneThread(entry_id, entry_type, (thread) => applyHistoryPage(thread, page));

          const unreadIds = incomingUnreadIds(page.messages);
          if (unreadIds.length > 0) {
            send("mark_read", { entry_id, entry_type, message_ids: unreadIds });
          }
          break;
        }

        case "conversation:message": {
          const { entry_id, entry_type, message } = event.payload;
          settleOutboxWith([message]);
          if (!isPaneEntry(entry_id, entry_type)) break;

          updatePaneThread(entry_id, entry_type, (thread) => applyLiveMessage(thread, message));
          if (incomingUnreadIds([message]).length > 0) {
            send("mark_read", { entry_id, entry_type, message_ids: [message.id] });
          }
          break;
        }

        case "conversation:message_sent": {
          const { entry_id, entry_type, message, request_id } = event.payload;
          commitOutbox(settleDelivered(request_id ? settleSend(outboxRef.current, request_id) : outboxRef.current, [message]));
          if (!isPaneEntry(entry_id, entry_type)) break;
          updatePaneThread(entry_id, entry_type, (thread) => applyLiveMessage(thread, message));
          break;
        }

        case "conversation:message_updated": {
          const { entry_id, entry_type, message } = event.payload;
          pendingMessageActionsRef.current = settleMessageActions(pendingMessageActionsRef.current, entry_id, entry_type, message.id);
          if (!isPaneEntry(entry_id, entry_type)) break;
          updatePaneThread(entry_id, entry_type, (thread) => applyMessageUpdate(thread, message));
          break;
        }

        case "conversation:window_reopened": {
          const reopened = event.payload;
          updatePaneThread(reopened.entry_id, reopened.entry_type, (thread) => applyWindowReopened(thread, reopened));
          break;
        }

        case "conversation:message_error": {
          failQueuedSend(event.payload.request_id, event.payload.code);
          toast.error(tSendError(sendErrorKey(event.payload.code)));
          break;
        }

        case "conversation:read": {
          const { entry_id, entry_type, message_ids, read_at } = event.payload;

          if (
            activeSubscriptionRef.current?.entry_id === entry_id &&
            activeSubscriptionRef.current?.entry_type === entry_type
          ) {
            setActiveConversation((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  message_ids.includes(m.id)
                    ? { ...m, read: true, read_at }
                    : m,
                ),
              };
            });
          }

          setInbox((prev) =>
            prev.map((e) =>
              e.entry_id === entry_id && e.entry_type === entry_type
                ? {
                    ...e,
                    unread_count: Math.max(
                      0,
                      e.unread_count - message_ids.length,
                    ),
                  }
                : e,
            ),
          );
          break;
        }

        case "conversation:typing": {
          const { entry_id, entry_type, user_id, is_typing } = event.payload;
          setTypingByEntry((prev) =>
            reduceTyping(prev, {
              type: "typing",
              entryId: entry_id,
              entryType: entry_type,
              userId: user_id,
              isTyping: is_typing,
            }),
          );
          break;
        }

        case "conversation:message_status": {
          const {
            entry_id,
            entry_type,
            message_id,
            status: deliveryStatus,
          } = event.payload;
          if (
            activeSubscriptionRef.current?.entry_id === entry_id &&
            activeSubscriptionRef.current?.entry_type === entry_type
          ) {
            setActiveConversation((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === message_id
                    ? { ...m, delivery_status: deliveryStatus }
                    : m,
                ),
              };
            });
          }
          break;
        }

        case "conversation:viewers": {
          const viewers = event.payload;
          setViewersByEntry((prev) => applyViewers(prev, viewers));
          break;
        }

        case "conversation:unsubscribed": {
          forgetTyping(event.payload.entry_id, event.payload.entry_type);
          setViewersByEntry((prev) => forgetViewers(prev, event.payload.entry_id, event.payload.entry_type));
          if (
            activeSubscriptionRef.current?.entry_id ===
              event.payload.entry_id &&
            activeSubscriptionRef.current?.entry_type ===
              event.payload.entry_type
          ) {
            setActiveConversation(null);
            activeSubscriptionRef.current = null;
            stopLoadingConversation();
          }
          break;
        }

        case "conversation:stage_update": {
          const { entry_id, entry_type, stage } = event.payload;
          setInbox((prev) =>
            prev.map((e) =>
              e.entry_id === entry_id && e.entry_type === entry_type
                ? { ...e, stage }
                : e,
            ),
          );
          setFunnelColumns((prev) => {
            const newMap = new Map<string, FunnelColumnState>();
            const newTagId = stage?.stage_id ?? null;
            let entryToMove: InboxEntry | null = null;

            for (const [stageId, columnState] of prev) {
              if (!columnState?.entries) {
                newMap.set(stageId, columnState);
                continue;
              }

              const existingEntry = columnState.entries.find(
                (e) => e.entry_id === entry_id && e.entry_type === entry_type,
              );
              if (existingEntry && !entryToMove) {
                entryToMove = { ...existingEntry, stage };
              }

              const filteredEntries = columnState.entries.filter(
                (e) =>
                  !(e.entry_id === entry_id && e.entry_type === entry_type),
              );

              const removed =
                columnState.entries.length - filteredEntries.length;
              newMap.set(stageId, {
                ...columnState,
                entries: filteredEntries,
                totalItems: Math.max(0, columnState.totalItems - removed),
              });
            }

            if (entryToMove) {
              if (!newTagId) {
                const untaggedCol = newMap.get("__unstaged__");
                if (untaggedCol) {
                  newMap.set("__unstaged__", {
                    ...untaggedCol,
                    entries: [entryToMove, ...untaggedCol.entries],
                    totalItems: untaggedCol.totalItems + 1,
                  });
                }
              } else {
                const colState = newMap.get(newTagId);
                if (colState) {
                  newMap.set(newTagId, {
                    ...colState,
                    entries: [entryToMove!, ...colState.entries],
                    totalItems: colState.totalItems + 1,
                  });
                }
              }
            }

            return newMap;
          });
          setKanbanSummary((prev) => {
            const newSummary = new Map(prev);
            return newSummary;
          });
          break;
        }

        case "conversation:label_update": {
          const { entry_id, entry_type, labels } = event.payload;
          setInbox((prev) =>
            prev.map((e) =>
              e.entry_id === entry_id && e.entry_type === entry_type
                ? { ...e, labels }
                : e,
            ),
          );
          setFunnelColumns((prev) => {
            const newMap = new Map<string, FunnelColumnState>();
            for (const [stageId, columnState] of prev) {
              if (!columnState?.entries) {
                newMap.set(stageId, columnState);
                continue;
              }
              newMap.set(stageId, {
                ...columnState,
                entries: columnState.entries.map((e) =>
                  e.entry_id === entry_id && e.entry_type === entry_type
                    ? { ...e, labels }
                    : e,
                ),
              });
            }
            return newMap;
          });
          break;
        }

        case "conversation:search_results": {
          const { entries, page, total_pages, total_items } = event.payload;
          const filled = entries.map(withEntryStringDefaults);
          if (page > 1) {
            setSearchResults((prev) => {
              if (!prev) return filled;
              const existingIds = new Set(
                prev.map((e) => `${e.entry_id}:${e.entry_type}`),
              );
              const newEntries = filled.filter(
                (e: InboxEntry) =>
                  !existingIds.has(`${e.entry_id}:${e.entry_type}`),
              );
              return [...prev, ...newEntries];
            });
          } else {
            setSearchResults(filled);
          }
          setSearchPageNum(page);
          setSearchTotalPages(total_pages);
          setSearchTotalItems(total_items);
          setSearching(false);
          setLoadingSearchMore(false);
          break;
        }

        case "conversation:search_messages_results": {
          const {
            entry_id,
            entry_type,
            messages: rawMessages,
            page,
            total_pages,
            total_items,
            query,
          } = event.payload;
          const asked = paneSearchRef.current;
          if (!asked || asked.entry_id !== entry_id || asked.entry_type !== entry_type || asked.query !== query) {
            break;
          }
          const results = rawMessages ?? [];
          setMessageSearchResults(results);
          setMessageSearchPageNum(page);
          setMessageSearchTotalPages(total_pages);
          setMessageSearchTotalItems(total_items);
          setMessageSearchQuery(query);
          setSearchingMessages(false);
          break;
        }


        case "conversation:funnel_column": {
          const p = event.payload;
          setLoadingKanbanColumn(null);
          setFunnelColumns((prev) => {
            const newMap = new Map(prev);
            const existingColumn = prev.get(p.stage_id);
            const newEntries =
              p.page <= 1
                ? p.entries
                : [
                    ...(existingColumn?.entries ?? []),
                    ...p.entries.filter(
                      (e) =>
                        !existingColumn?.entries.some(
                          (ex) =>
                            ex.entry_id === e.entry_id &&
                            ex.entry_type === e.entry_type,
                        ),
                    ),
                  ];
            newMap.set(p.stage_id, {
              entries: newEntries,
              page: p.page,
              pageSize: p.page_size,
              totalItems: p.total_items,
              totalPages: p.total_pages,
              loading: false,
            });
            return newMap;
          });
          break;
        }

        case "conversation:funnel_summary": {
          const p = event.payload;
          setKanbanSummary((prev) => {
            const newMap = new Map(prev);
            for (const col of p.columns) {
              newMap.set(col.stage_id, col.total_items);
            }
            return newMap;
          });
          break;
        }

        case "conversation:view_switched": {
          const {
            view_mode,
            campaign_id,
            campaign_type,
            whatsapp_campaign_type,
            conversation_status,
          } = event.payload;
          setViewMode(view_mode);
          currentViewRef.current = {
            campaignId: campaign_id ?? "",
            campaignType: campaign_type as CampaignType | undefined,
            whatsAppCampaignType: whatsapp_campaign_type as
              | WhatsAppCampaignTypeFilter
              | undefined,
            containerKind: currentViewRef.current.containerKind,
            conversationStatus: conversation_status ?? "",
          };
          if (campaign_type) {
            connectionParamsRef.current = {
              ...connectionParamsRef.current,
              campaignType: campaign_type as CampaignType,
            };
          }
          setFunnelColumns((prev) => (prev.size === 0 ? prev : new Map()));
          setKanbanSummary((prev) => (prev.size === 0 ? prev : new Map()));
          setLoadingKanbanColumn((prev) => (prev === null ? prev : null));
          break;
        }

        case "conversation:lead_update": {
          handleLeadUpdate(event.payload);
          break;
        }

        case "conversation:leads_bulk_update": {
          handleLeadsBulkUpdate(event.payload);
          break;
        }

        case "notification:created": {
          if (isNotificationCreatedEvent(event.payload)) emitNotificationCreated(event.payload);
          break;
        }

        case "team_chat:message":
        case "team_chat:message_updated":
        case "team_chat:read":
        case "team_chat:thread":
        case "team_chat:thread_removed":
        case "team_chat:typing":
        case "team_chat:scheduled": {
          const teamEvent = readTeamChatEvent(event.type, event.payload);
          if (teamEvent) emitTeamChat(teamEvent);
          break;
        }

        case "conversation:analysis_update": {
          const { entry_id, entry_type, analysis, pending } = event.payload;
          setLatestAnalysisUpdate(event.payload);
          const applyAnalysis = (e: InboxEntry): InboxEntry => ({
            ...e,
            latest_analysis: analysis ?? e.latest_analysis,
            analysis_phase: pending ? "queued" : undefined,
          });
          setInbox((prev) => patchEntries(prev, entry_id, entry_type, applyAnalysis));
          setFunnelColumns((prev) => patchColumns(prev, entry_id, entry_type, applyAnalysis));
          break;
        }


        case "conversation:error": {
          console.error("[ConversationWS] Server error:", event.payload);
          const refusedAction = takeRefusedMessageAction(pendingMessageActionsRef.current, event.payload.request_id);
          pendingMessageActionsRef.current = refusedAction.pending;
          if (refusedAction.refused) {
            toast.error(tMessageAction(messageActionErrorKey(event.payload.code, refusedAction.refused.kind)));
            break;
          }
          if (failQueuedSend(event.payload.request_id, event.payload.code)) {
            toast.error(tSendError(sendErrorKey(event.payload.code)));
            break;
          }
          if (event.payload.code === "not_found" && event.payload.entry_id && event.payload.entry_type) {
            forgetRefusedJump(event.payload.entry_id, event.payload.entry_type);
            break;
          }
          if (
            event.payload.entry_id &&
            event.payload.entry_type &&
            event.payload.status
          ) {
            rollbackPendingStatusChange(
              event.payload.entry_id,
              event.payload.entry_type,
              event.payload.previous_status,
            );
            if (
              event.payload.code === "outcome_required" ||
              event.payload.code === "outcome_unknown"
            ) {
              setPendingOutcomeRequest({
                entryId: event.payload.entry_id,
                entryType: event.payload.entry_type,
                status: event.payload.status,
                message: event.payload.message,
                outcomes: event.payload.outcomes ?? [],
              });
              break;
            }
            toast.error(event.payload.message || tActions("statusUpdateFailed"));
            break;
          }
          if (isTemplateSendRefusal(event.payload)) {
            toast.error(tOutreach(outreachRefusalKey(event.payload.code)));
            break;
          }
          switch (event.payload.code) {
            case "insufficient_balance":
              toast.error(tActions("insufficientBalance"));
              break;
          }
          break;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [send, routeEventToWindows, routeHistory, handleLeadUpdate, handleLeadsBulkUpdate, applyConversationLead, vouchSubscribed, tOutreach, tSendError, tMessageAction, offerAssignmentUndo, settleOutboxWith, keepPrefetched, isPaneEntry, updatePaneThread, commitOutbox, failQueuedSend, forgetRefusedJump, personalMarks.observe],
  );


  const catchUpHeldThreads = useCallback(() => {
    const active = activeConversationRef.current;
    const held: [HistoryHolder, ActiveConversation][] = [
      ...(active && isPaneEntry(active.entry_id, active.entry_type) ? [["pane", active] as [HistoryHolder, ActiveConversation]] : []),
      ...[...windowConversationsRef.current.values()].map((w): [HistoryHolder, ActiveConversation] => ["window", w.conversation]),
    ];
    for (const [holder, thread] of held) {
      const after = newestMessageAt(thread);
      if (!after) continue;
      requestPage(holder, thread.entry_id, thread.entry_type, "after", loadAfterPayload(thread.entry_id, thread.entry_type, after));
    }
  }, [isPaneEntry, requestPage]);

  const refreshInboxView = useCallback(() => {
    const view = currentViewRef.current;
    if (isDefaultView(view)) return;
    send("switch_view", switchViewPayload(view));
  }, [send]);

  const connect = useCallback(async () => {
    const { token, campaignId, campaignType, enabled, workspaceId, departmentId } =
      connectionParamsRef.current;

    if (!token || !enabled || !workspaceId) {
      return;
    }

    if (isConnectingRef.current) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    isConnectingRef.current = true;
    intentionalDisconnectRef.current = false;
    setStatus("connecting");

    const existingSocket = wsRef.current;
    if (existingSocket) {
      try {
        existingSocket.onclose = null;
        existingSocket.onerror = null;
        existingSocket.onmessage = null;
        existingSocket.onopen = null;
        const readyState = existingSocket.readyState;
        if (
          readyState === WebSocket.OPEN ||
          readyState === WebSocket.CONNECTING
        ) {
          existingSocket.close();
        }
      } catch {
      }
      wsRef.current = null;
    }

    if (intentionalDisconnectRef.current || !connectionParamsRef.current.enabled) {
      isConnectingRef.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (campaignId) params.set("campaignId", campaignId);
    if (campaignType) params.set("campaignType", campaignType);
    if (workspaceId) {
      params.set("workspaceId", workspaceId);
    } else {
      const wsIdMatch = document.cookie.match(/(?:^|;\s*)workspaceId=([^;]*)/);
      if (wsIdMatch?.[1])
        params.set("workspaceId", decodeURIComponent(wsIdMatch[1]));
    }
    if (departmentId) {
      params.set("departmentId", departmentId);
    } else {
      const deptIdMatch = document.cookie.match(
        /(?:^|;\s*)departmentId=([^;]*)/,
      );
      if (deptIdMatch?.[1])
        params.set("departmentId", decodeURIComponent(deptIdMatch[1]));
    }
    const wsUrl = `${WS_BASE_URL}/ws/conversations?${params.toString()}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      isConnectingRef.current = false;
      setStatus("connected");

      const wasReconnect = everConnectedRef.current;
      everConnectedRef.current = true;

      const stableTimer = setTimeout(() => {
        controllerRef.current?.resetBackoff();
      }, 5000);
      ws.addEventListener("close", () => clearTimeout(stableTimer), {
        once: true,
      });

      ws.send(
        JSON.stringify({
          type: "request_connected_users",
        }),
      );

      dropSubscribesInFlight();
      if (wasReconnect) {
        refreshInboxView();
        for (const { entryId, entryType } of subscriptionHoldersRef.current.values()) {
          sendSubscribe(entryId, entryType);
        }
        catchUpHeldThreads();
      }
      for (const item of replayableSends(outboxRef.current)) dispatchOutboxItem(item);
    };

    ws.onmessage = (evt) => {
      const raw = evt.data as string;
      const chunks = raw.split("\n").filter((s: string) => s.trim());

      for (const chunk of chunks) {
        try {
          const data = JSON.parse(chunk) as WsServerEvent;
          handleServerEvent(data);
        } catch (err) {
          console.error("[ConversationWS] Parse error:", err);
        }
      }
    };

    ws.onerror = () => {
      isConnectingRef.current = false;
      setStatus("error");
    };

    ws.onclose = () => {
      isConnectingRef.current = false;

      if (wsRef.current !== ws) return;

      setStatus("disconnected");

      wsRef.current = null;

      historyRequestsRef.current = noHistoryRequests;
      setLoadingHistory(false);
      if (loadingConversationTimerRef.current) {
        clearTimeout(loadingConversationTimerRef.current);
        loadingConversationTimerRef.current = null;
      }
      setLoadingConversation(false);

      const settled = clearWindowLoading(windowConversationsRef.current);
      if (settled !== windowConversationsRef.current) {
        windowConversationsRef.current = settled;
        setWindowConversations(settled);
      }

      controllerRef.current?.scheduleReconnect();
    };
  }, [handleServerEvent, dropSubscribesInFlight, sendSubscribe, catchUpHeldThreads, refreshInboxView, dispatchOutboxItem]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true;
    isConnectingRef.current = false;

    controllerRef.current?.stop();

    if (wsRef.current) {
      const ws = wsRef.current;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.onopen = null;

      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
      wsRef.current = null;
    }

    setStatus("disconnected");
  }, []);

  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  const hasToken = !!token;
  useEffect(() => {
    if (enabled && hasToken && workspaceId) {
      controllerRef.current?.start();
      const connectTimeout = setTimeout(() => {
        connectRef.current?.();
      }, 50);

      return () => {
        clearTimeout(connectTimeout);
        disconnectRef.current?.();
        setActiveConversation(null);
        activeSubscriptionRef.current = null;
        threadCacheRef.current = emptyThreadCache;
        historyRequestsRef.current = noHistoryRequests;
        outboxRef.current = emptyOutbox;
        setOutbox(emptyOutbox);
      };
    } else {
      disconnectRef.current?.();
      setActiveConversation(null);
      activeSubscriptionRef.current = null;
    }
  }, [enabled, hasToken, workspaceId, departmentId]);


  const seedThreadFor = useCallback((entryId: string, entryType: EntryType): CachedThread | null => {
    const key = windowKey(entryId, entryType);
    const window = windowConversationsRef.current.get(key)?.conversation;
    if (window && window.messages.length > 0 && !window.has_after) {
      return { messages: window.messages, has_more: window.has_more, total: window.total };
    }
    const recalled = recallThread(threadCacheRef.current, scopeKeyRef.current, key);
    threadCacheRef.current = recalled.cache;
    return recalled.thread;
  }, []);

  const listedEntry = useCallback((entryId: string, entryType: EntryType): InboxEntry | undefined => {
    const matches = (entry: InboxEntry) => entry.entry_id === entryId && entry.entry_type === entryType;
    return inboxRef.current.find(matches) ?? searchResultsRef.current?.find(matches);
  }, []);

  const startLoadingConversation = useCallback(() => {
    if (loadingConversationTimerRef.current) {
      clearTimeout(loadingConversationTimerRef.current);
    }
    setLoadingConversation(true);
    loadingConversationTimerRef.current = setTimeout(() => {
      loadingConversationTimerRef.current = null;
      setLoadingConversation(false);
    }, 12000);
  }, []);

  const subscribe = useCallback(
    (entryId: string, entryType: EntryType) => {
      if (!entryId || !entryType) {
        console.warn(
          "[ConversationWS] subscribe called with empty entryId or entryType, skipping",
          { entryId, entryType },
        );
        return;
      }
      const previous = activeSubscriptionRef.current;
      const isSwitch =
        previous &&
        (previous.entry_id !== entryId || previous.entry_type !== entryType);
      if (isSwitch) rememberThreadOf(activeConversationRef.current);

      activeSubscriptionRef.current = {
        entry_id: entryId,
        entry_type: entryType,
      };

      retainSubscription(entryId, entryType, "pane");
      if (isSwitch) {
        releaseSubscription(previous.entry_id, previous.entry_type, "pane");
        setLoadingHistory(false);
      }

      const active = activeConversationRef.current;
      const alreadyLoaded =
        active?.entry_id === entryId &&
        active?.entry_type === entryType &&
        active.messages.length > 0;
      if (alreadyLoaded) return;

      startLoadingConversation();
      const seed = seedThreadFor(entryId, entryType);
      if (!seed) return;
      const seeded = seededConversation(entryId, entryType, listedEntry(entryId, entryType), seed);
      activeConversationRef.current = seeded;
      setActiveConversation(seeded);
      const after = newestMessageAt(seeded);
      if (after) requestPage("pane", entryId, entryType, "after", loadAfterPayload(entryId, entryType, after));
    },
    [retainSubscription, releaseSubscription, rememberThreadOf, startLoadingConversation, seedThreadFor, listedEntry, requestPage],
  );

  const unsubscribe = useCallback(() => {
    if (activeSubscriptionRef.current) {
      rememberThreadOf(activeConversationRef.current);
      releaseSubscription(
        activeSubscriptionRef.current.entry_id,
        activeSubscriptionRef.current.entry_type,
        "pane",
      );
      setActiveConversation(null);
      activeSubscriptionRef.current = null;
    }
    stopLoadingConversation();
  }, [releaseSubscription, stopLoadingConversation, rememberThreadOf]);

  const markRead = useCallback(
    (messageIds: string[]) => {
      if (!activeSubscriptionRef.current || messageIds.length === 0) return;
      send("mark_read", {
        entry_id: activeSubscriptionRef.current.entry_id,
        entry_type: activeSubscriptionRef.current.entry_type,
        message_ids: messageIds,
      });
    },
    [send],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!activeSubscriptionRef.current) return;
      send("typing", {
        entry_id: activeSubscriptionRef.current.entry_id,
        entry_type: activeSubscriptionRef.current.entry_type,
        is_typing: isTyping,
      });
    },
    [send],
  );


  const applyWindows = useCallback(
    (next: WindowConversations) => {
      if (next === windowConversationsRef.current) return;
      windowConversationsRef.current = next;
      setWindowConversations(next);
    },
    [],
  );

  const loadHistory = useCallback(() => {
    const active = activeConversationRef.current;
    if (loadingHistory || !active || !isPaneEntry(active.entry_id, active.entry_type)) return;
    if (active.messages.length === 0 || !active.has_more) return;
    const asked = requestPage("pane", active.entry_id, active.entry_type, "before", {
      entry_id: active.entry_id,
      entry_type: active.entry_type,
      before: active.messages[0].created_at,
    });
    if (asked) setLoadingHistory(true);
  }, [loadingHistory, isPaneEntry, requestPage]);

  const loadAround = useCallback(
    (anchor: HistoryAnchor) => {
      const pane = activeSubscriptionRef.current;
      if (!pane) return;
      const asked = requestPage("pane", pane.entry_id, pane.entry_type, "around", loadAroundPayload(pane.entry_id, pane.entry_type, anchor));
      if (asked) setLoadingHistory(true);
    },
    [requestPage],
  );

  const loadNewer = useCallback(() => {
    const active = activeConversationRef.current;
    if (loadingHistory || !active?.has_after || !isPaneEntry(active.entry_id, active.entry_type)) return;
    const after = newestMessageAt(active);
    if (!after) return;
    const asked = requestPage("pane", active.entry_id, active.entry_type, "after", loadAfterPayload(active.entry_id, active.entry_type, after));
    if (asked) setLoadingHistory(true);
  }, [loadingHistory, isPaneEntry, requestPage]);

  const returnToPresent = useCallback(() => {
    const pane = activeSubscriptionRef.current;
    if (!pane) return;
    const asked = requestPage("pane", pane.entry_id, pane.entry_type, "around", presentPayload(pane.entry_id, pane.entry_type, new Date()));
    if (asked) setLoadingHistory(true);
  }, [requestPage]);

  const windowLoadHistory = useCallback(
    (entryId: string, entryType: EntryType) => {
      const key = windowKey(entryId, entryType);
      const state = windowConversationsRef.current.get(key);
      if (!state || state.loadingHistory) return;

      const { messages, has_more } = state.conversation;
      if (messages.length === 0 || !has_more) return;

      const asked = requestPage("window", entryId, entryType, "before", {
        entry_id: entryId,
        entry_type: entryType,
        before: messages[0].created_at,
      });
      if (asked) applyWindows(markWindowLoadingHistory(windowConversationsRef.current, key));
    },
    [applyWindows, requestPage],
  );

  const windowLoadAround = useCallback(
    (entryId: string, entryType: EntryType, anchor: HistoryAnchor) => {
      const key = windowKey(entryId, entryType);
      if (!windowConversationsRef.current.has(key)) return;
      const asked = requestPage("window", entryId, entryType, "around", loadAroundPayload(entryId, entryType, anchor));
      if (asked) applyWindows(markWindowLoadingHistory(windowConversationsRef.current, key));
    },
    [applyWindows, requestPage],
  );

  const windowLoadNewer = useCallback(
    (entryId: string, entryType: EntryType) => {
      const key = windowKey(entryId, entryType);
      const state = windowConversationsRef.current.get(key);
      if (!state || state.loadingHistory || !state.conversation.has_after) return;
      const after = newestMessageAt(state.conversation);
      if (!after) return;
      const asked = requestPage("window", entryId, entryType, "after", loadAfterPayload(entryId, entryType, after));
      if (asked) applyWindows(markWindowLoadingHistory(windowConversationsRef.current, key));
    },
    [applyWindows, requestPage],
  );

  const windowReturnToPresent = useCallback(
    (entryId: string, entryType: EntryType) => {
      const key = windowKey(entryId, entryType);
      if (!windowConversationsRef.current.has(key)) return;
      const asked = requestPage("window", entryId, entryType, "around", presentPayload(entryId, entryType, new Date()));
      if (asked) applyWindows(markWindowLoadingHistory(windowConversationsRef.current, key));
    },
    [applyWindows, requestPage],
  );

  const bringToPresent = useCallback(
    (entryId: string, entryType: EntryType) => {
      if (isPaneEntry(entryId, entryType) && activeConversationRef.current?.has_after) returnToPresent();
      if (windowConversationsRef.current.get(windowKey(entryId, entryType))?.conversation.has_after) {
        windowReturnToPresent(entryId, entryType);
      }
    },
    [isPaneEntry, returnToPresent, windowReturnToPresent],
  );

  const queueSend = useCallback(
    (entryId: string, entryType: EntryType, payload: OutboxPayload) => {
      const queued = { requestId: newRequestId(), entryId, entryType, payload, queuedAt: new Date().toISOString() };
      commitOutbox(enqueueSend(outboxRef.current, queued));
      dispatchOutboxItem({ ...queued, state: "pending" });
      if (payload.kind !== "resend") bringToPresent(entryId, entryType);
    },
    [commitOutbox, dispatchOutboxItem, bringToPresent],
  );

  const sendFromPane = useCallback(
    (payload: OutboxPayload) => {
      const pane = activeSubscriptionRef.current;
      if (!pane) return;
      queueSend(pane.entry_id, pane.entry_type, payload);
    },
    [queueSend],
  );

  const sendMessage = useCallback(
    (text: string, signed: boolean, replyToMessageId?: string) => {
      sendFromPane({ kind: "text", text, signed, replyToMessageId });
    },
    [sendFromPane],
  );

  const sendMediaMessage = useCallback(
    (text: string, mediaId: string, mediaType: MediaType, signed: boolean, replyToMessageId?: string) => {
      sendFromPane({ kind: "media", text, mediaId, mediaType, signed, replyToMessageId });
    },
    [sendFromPane],
  );

  const sendButtonMessage = useCallback(
    (input: SendButtonWsInput, replyToMessageId?: string) => {
      sendFromPane({ kind: "buttons", input, replyToMessageId });
    },
    [sendFromPane],
  );

  const retrySend = useCallback(
    (requestId: string) => {
      const { outbox: next, item } = retryOutboxSend(outboxRef.current, requestId);
      commitOutbox(next);
      if (item) dispatchOutboxItem(item);
    },
    [commitOutbox, dispatchOutboxItem],
  );

  const resendMessage = useCallback(
    (entryId: string, entryType: EntryType, messageId: string) => {
      if (resendingMessageIds(outboxRef.current, entryId, entryType).has(messageId)) return;
      queueSend(entryId, entryType, { kind: "resend", messageId });
    },
    [queueSend],
  );

  const runMessageAction = useCallback(
    (request: MessageActionRequest): boolean => {
      const requestId = newRequestId();
      const command = messageCommand(request, requestId);
      if (!send(command.type, command.payload)) return false;
      pendingMessageActionsRef.current = trackMessageAction(pendingMessageActionsRef.current, requestId, pendingOf(request));
      return true;
    },
    [send],
  );

  const reopenWindow = useCallback(
    (entryId: string, entryType: EntryType, templateId: string, parameters: string[]) => {
      send("reopen_window", {
        entry_id: entryId,
        entry_type: entryType,
        template_id: templateId,
        parameters,
        request_id: newRequestId(),
      });
    },
    [send],
  );

  const prefetchConversation = useCallback(
    (entryId: string, entryType: EntryType) => {
      const key = windowKey(entryId, entryType);
      if (!entryId || !entryType || isPaneEntry(entryId, entryType)) return;
      if (windowConversationsRef.current.has(key)) return;
      if (holdsThread(threadCacheRef.current, scopeKeyRef.current, key)) return;
      if (hasHistoryRequest(historyRequestsRef.current, key, "before", "prefetch")) return;
      requestPage("prefetch", entryId, entryType, "before", {
        entry_id: entryId,
        entry_type: entryType,
        before: new Date().toISOString(),
      });
    },
    [isPaneEntry, requestPage],
  );

  const openConversationWindow = useCallback(
    (input: OpenWindowConversationInput) => {
      if (!input.entryId || !input.entryType) return;
      const key = windowKey(input.entryId, input.entryType);
      const current = windowConversationsRef.current;
      const alreadyOpen = current.has(key);

      let next = current;
      let retired: { entryId: string; entryType: EntryType } | null = null;
      if (!alreadyOpen && current.size >= MAX_OPEN_WINDOWS) {
        const oldestKey = current.keys().next().value as string | undefined;
        const oldest = oldestKey ? current.get(oldestKey) : undefined;
        if (oldest && oldestKey) {
          retired = {
            entryId: oldest.conversation.entry_id,
            entryType: oldest.conversation.entry_type,
          };
          rememberThreadOf(oldest.conversation);
          next = closeWindowConversation(next, oldestKey);
        }
      }

      applyWindows(openWindowConversation(next, input));

      if (retired) releaseSubscription(retired.entryId, retired.entryType, "window");
      if (!alreadyOpen) {
        retainSubscription(input.entryId, input.entryType, "window");
        requestPage("window", input.entryId, input.entryType, "before", {
          entry_id: input.entryId,
          entry_type: input.entryType,
          before: new Date().toISOString(),
        });
      }

      windowFocusNonceRef.current += 1;
      setWindowFocusRequest({ key, nonce: windowFocusNonceRef.current });
    },
    [applyWindows, releaseSubscription, retainSubscription, requestPage, rememberThreadOf],
  );

  const closeConversationWindow = useCallback(
    (entryId: string, entryType: EntryType) => {
      const key = windowKey(entryId, entryType);
      const closing = windowConversationsRef.current.get(key);
      if (!closing) return;
      rememberThreadOf(closing.conversation);
      applyWindows(closeWindowConversation(windowConversationsRef.current, key));
      releaseSubscription(entryId, entryType, "window");
    },
    [applyWindows, releaseSubscription, rememberThreadOf],
  );

  const setConversationWindowVisible = useCallback(
    (entryId: string, entryType: EntryType, visible: boolean) => {
      const key = windowKey(entryId, entryType);
      const current = windowConversationsRef.current.get(key);
      if (!current || current.visible === visible) return;

      if (visible) {
        const unreadIds = unreadIdsIn(current);
        if (unreadIds.length > 0) {
          send("mark_read", {
            entry_id: entryId,
            entry_type: entryType,
            message_ids: unreadIds,
          });
        }
      }

      applyWindows(
        setWindowVisibility(windowConversationsRef.current, key, visible),
      );
    },
    [applyWindows, send],
  );

  const windowSendMessage = useCallback(
    (entryId: string, entryType: EntryType, text: string, signed: boolean, replyToMessageId?: string) => {
      queueSend(entryId, entryType, { kind: "text", text, signed, replyToMessageId });
    },
    [queueSend],
  );

  const windowSendMedia = useCallback(
    (
      entryId: string,
      entryType: EntryType,
      text: string,
      mediaId: string,
      mediaType: MediaType,
      signed: boolean,
      replyToMessageId?: string,
    ) => {
      queueSend(entryId, entryType, { kind: "media", text, mediaId, mediaType, signed, replyToMessageId });
    },
    [queueSend],
  );

  const windowSendButton = useCallback(
    (entryId: string, entryType: EntryType, input: SendButtonWsInput, replyToMessageId?: string) => {
      queueSend(entryId, entryType, { kind: "buttons", input, replyToMessageId });
    },
    [queueSend],
  );

  const windowSendTyping = useCallback(
    (entryId: string, entryType: EntryType, isTyping: boolean) => {
      send("typing", {
        entry_id: entryId,
        entry_type: entryType,
        is_typing: isTyping,
      });
    },
    [send],
  );

  const windowSearchMessages = useCallback(
    (entryId: string, entryType: EntryType, query: string) => {
      const key = windowKey(entryId, entryType);
      const trimmed = query.trim();
      if (!trimmed || !windowConversationsRef.current.has(key)) return;
      applyWindows(startWindowSearch(windowConversationsRef.current, key, trimmed));
      send("search_messages", {
        entry_id: entryId,
        entry_type: entryType,
        query: trimmed,
        page: 1,
        page_size: 50,
      });
    },
    [applyWindows, send],
  );

  const windowClearMessageSearch = useCallback(
    (entryId: string, entryType: EntryType) => {
      applyWindows(clearWindowSearch(windowConversationsRef.current, windowKey(entryId, entryType)));
    },
    [applyWindows],
  );

  const requestInboxPage = useCallback(
    (page: number) => {
      if (loadingInbox) return;
      setLoadingInbox(true);
      send("request_inbox_page", { page });
    },
    [send, loadingInbox],
  );

  const searchInbox = useCallback(
    (filters: WsSearchInboxPayload) => {
      setSearching(true);
      setCurrentSearchFilters(filters);
      send("search_inbox", { ...filters } as Record<string, unknown>);
    },
    [send],
  );

  const requestSearchPage = useCallback(
    (page: number) => {
      if (loadingSearchMore || !currentSearchFilters) return;
      setLoadingSearchMore(true);
      send("search_inbox", { ...currentSearchFilters, page } as Record<
        string,
        unknown
      >);
    },
    [send, loadingSearchMore, currentSearchFilters],
  );

  const clearSearch = useCallback(() => {
    setSearchResults(null);
    setSearching(false);
    setSearchTotalItems(0);
    setSearchTotalPages(0);
    setSearchPageNum(1);
    setCurrentSearchFilters(null);
    setLoadingSearchMore(false);
  }, []);

  const searchMessages = useCallback(
    (query: string, page: number = 1) => {
      if (!activeSubscriptionRef.current) {
        console.warn(
          "[ConversationWS] Cannot search messages: no active conversation",
        );
        return;
      }
      if (!query || query.trim().length === 0) {
        console.warn("[ConversationWS] Cannot search messages: empty query");
        return;
      }
      setSearchingMessages(true);
      setMessageSearchQuery(query.trim());
      paneSearchRef.current = { ...activeSubscriptionRef.current, query: query.trim() };
      send("search_messages", {
        entry_id: activeSubscriptionRef.current.entry_id,
        entry_type: activeSubscriptionRef.current.entry_type,
        query: query.trim(),
        page,
        page_size: 50,
      });
    },
    [send],
  );

  const clearMessageSearch = useCallback(() => {
    paneSearchRef.current = null;
    setMessageSearchResults(null);
    setSearchingMessages(false);
    setMessageSearchTotalItems(0);
    setMessageSearchTotalPages(0);
    setMessageSearchPageNum(1);
    setMessageSearchQuery(null);
  }, []);


  const requestFunnelColumn = useCallback(
    (stageId: string, page: number = 1, pageSize: number = 20) => {
      setLoadingKanbanColumn(stageId);
      setFunnelColumns((prev) => {
        const existing = prev.get(stageId);
        if (!existing) return prev;
        const newMap = new Map(prev);
        newMap.set(stageId, { ...existing, loading: true });
        return newMap;
      });
      send("request_funnel_column", {
        stage_id: stageId,
        page,
        page_size: pageSize,
      });
    },
    [send],
  );

  const requestFunnelSummary = useCallback(
    (tagIds: string[]) => {
      send("request_funnel_summary", { stage_ids: tagIds });
    },
    [send],
  );

  const clearFunnelColumns = useCallback(() => {
    setFunnelColumns(new Map());
    setKanbanSummary(new Map());
    setLoadingKanbanColumn(null);
  }, []);


  const assignTo = useCallback(
    (entryId: string, entryType: string, userId: string) => {
      const previous =
        inboxRef.current.find(
          (e) => e.entry_id === entryId && e.entry_type === entryType,
        )?.assigned_user_id ?? "";
      if (assigneeKind(previous) === "human" && previous !== userId) {
        assignmentLedgerRef.current = beginOperation(assignmentLedgerRef.current, {
          id: newRequestId(),
          target: windowKey(entryId, entryType),
          snapshot: { previous, requested: userId },
        });
      }
      sendAssign(entryId, entryType, userId);
    },
    [sendAssign],
  );

  const forgetEntry = useCallback(
    (entryId: string, entryType: EntryType) => {
      handleServerEvent({
        type: "conversation:entry_removed",
        payload: { entry_id: entryId, entry_type: entryType, reason: "handed_back" },
      });
    },
    [handleServerEvent],
  );

  const setConversationStatus = useCallback(
    (entryId: string, entryType: string, status: string, outcomeCode?: string) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        toast.error(tActions("connectionNotReady"));
        return;
      }

      const target = { entryId, entryType };
      const statusPatch =
        status === "finished"
          ? {
              conversation_status: status,
              close_source: "human" as const,
              close_reason: "manual" as const,
              closed_at: new Date().toISOString(),
            }
          : { conversation_status: status };

      statusLedgerRef.current = beginOperation(statusLedgerRef.current, {
        id: newRequestId(),
        target: windowKey(entryId, entryType),
        snapshot: snapshotViews(
          {
            inbox: inboxRef.current,
            search: searchResultsRef.current,
            active: activeConversationRef.current,
          },
          target,
          statusPatch,
        ),
      });

      const membership = statusMembership();
      setInbox((prev) => {
        const updated = applyToList(prev, target, statusPatch, membership.inbox);
        inboxRef.current = updated;
        return updated;
      });
      setSearchResults((prev) =>
        prev && applyToList(prev, target, statusPatch, membership.search),
      );
      setActiveConversation((prev) => applyToActive(prev, target, statusPatch));
      send("set_conversation_status", {
        entry_id: entryId,
        entry_type: entryType,
        status,
        ...(outcomeCode ? { outcome_code: outcomeCode } : {}),
      });
    },
    [send, statusMembership, tActions],
  );

  const clearPendingOutcomeRequest = useCallback(() => {
    setPendingOutcomeRequest(null);
  }, []);

  const switchView = useCallback(
    (
      newCampaignId?: string,
      newCampaignType?: CampaignType,
      newWhatsAppCampaignType?: WhatsAppCampaignTypeFilter,
      newConversationStatus?: string,
      newContainerKind?: ContainerKind,
    ) => {
      const previousView = currentViewRef.current;
      const nextView: InboxView = {
        campaignId: newCampaignId ?? "",
        campaignType: newCampaignType,
        whatsAppCampaignType: newWhatsAppCampaignType,
        containerKind: newContainerKind,
        conversationStatus: newConversationStatus ?? previousView.conversationStatus,
      };
      if (sameView(previousView, nextView)) return;
      const onlyStatusChanged = sameView(previousView, {
        ...nextView,
        conversationStatus: previousView.conversationStatus,
      });

      currentViewRef.current = nextView;
      send("switch_view", switchViewPayload(nextView));

      if (!onlyStatusChanged) {
        setActiveConversation(null);
        activeSubscriptionRef.current = null;
      }
      setInbox([]);
      inboxRef.current = [];
      setInboxPage(1);
      setInboxTotalPages(1);
      setInboxTotalItems(0);
      setInboxStageCounts({});
      setSearchResults(null);
      setCurrentSearchFilters(null);
      setMessageSearchResults(null);
      setMessageSearchQuery(null);
    },
    [send],
  );

  const inboxHasMore = inboxPage < inboxTotalPages;
  const searchHasMore = searchPageNum < searchTotalPages;

  const totalUnread = inbox.reduce((sum, e) => sum + e.unread_count, 0);

  const clearUnread = useCallback((entries: readonly MarkedEntry[]) => {
    setInbox((prev) => {
      const next = clearUnreadCounts(prev, entries);
      inboxRef.current = next;
      return next;
    });
    setSearchResults((prev) => prev && clearUnreadCounts(prev, entries));
  }, []);
  const personalInbox = useMemo<PersonalInboxControls>(
    () => ({ ...personalMarks.commands, clearUnread }),
    [personalMarks.commands, clearUnread],
  );

  return {
    status,
    inbox,
    connectedUsers,
    activeConversation,
    pendingOutcomeRequest,
    clearPendingOutcomeRequest,
    subscribe,
    unsubscribe,
    sendMessage,
    sendMediaMessage,
    sendButtonMessage,
    markRead,
    sendTyping,
    typingByEntry,
    totalUnread,
    loadHistory,
    loadAround,
    loadNewer,
    returnToPresent,
    prefetchConversation,
    outbox,
    retrySend,
    resendMessage,
    reopenWindow,
    loadingHistory,
    loadingConversation,
    requestInboxPage,
    inboxHasMore,
    inboxTotalItems,
    inboxStageCounts,
    conversationStatusCounts,
    loadingInbox,
    searchInbox,
    clearSearch,
    searchResults,
    searching,
    searchTotalItems,
    searchTotalPages,
    searchPage: searchPageNum,
    searchHasMore,
    requestSearchPage,
    loadingSearchMore,
    searchMessages,
    clearMessageSearch,
    messageSearchResults,
    searchingMessages,
    messageSearchTotalItems,
    messageSearchTotalPages,
    messageSearchPage: messageSearchPageNum,
    messageSearchQuery,
    funnelColumns,
    funnelSummary,
    loadingFunnelColumn,
    requestFunnelColumn,
    requestFunnelSummary,
    clearFunnelColumns,
    viewMode,
    switchView,
    latestAnalysisUpdate,
    assignTo,
    forgetEntry,
    setConversationStatus,
    applyLeadPatch,
    subscribeLeadUpdates,
    subscribeLeadsBulkUpdates,
    subscribeServerEvents,
    viewersByEntry,
    runMessageAction,
    windowConversations,
    windowFocusRequest,
    openConversationWindow,
    closeConversationWindow,
    setConversationWindowVisible,
    windowSendMessage,
    windowSendMedia,
    windowSendButton,
    windowSendTyping,
    windowLoadHistory,
    windowSearchMessages,
    windowClearMessageSearch,
    windowLoadAround,
    windowLoadNewer,
    windowReturnToPresent,
    personalInbox,
  };
}

"use client";

import type {
  ActiveConversation,
  CampaignType,
  ContainerKind,
  ConnectedUser,
  ConnectionStatus,
  ConversationMessage,
  EntryType,
  InboxEntry,
  MediaType,
  MessageChannel,
  ViewMode,
  WhatsAppCampaignTypeFilter,
  WsAnalysisUpdatePayload,
  WsSearchInboxPayload,
  WsServerEvent,
} from "@/lib/conversations/types";
import { useCallback, useEffect, useRef, useState } from "react";

import { hasUserDataCookie } from "@/lib/auth/client-cookies";
import { resolveAutomationEnabled } from "@/lib/conversations/automation";
import {
  applyWindowEvent,
  closeWindowConversation,
  clearWindowLoading,
  emptyWindowConversations,
  incomingUnreadIds,
  markWindowLoadingMore,
  openWindowConversation,
  setWindowVisibility,
  unreadIdsIn,
  type OpenWindowConversationInput,
  type WindowConversations,
} from "@/lib/conversations/windowed-conversations";
import { MAX_OPEN_WINDOWS, windowKey } from "@/lib/conversations/window-deck";
import {
  createReconnectController,
  type ReconnectController,
} from "@/lib/ws/reconnect";
import { toast } from "sonner";
import { useDepartment } from "@/contexts/department-context";
import useSound from "use-sound";
import { useWorkspace } from "@/contexts/workspace-context";

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

/**
 * Fills the string fields the server tags `omitempty` but the type declares as
 * plain `string`.
 *
 * `lead_name`, `lead_number` and the `last_message_*` trio are all omitted from
 * the JSON when empty, so an unnamed group or a channel entry with no phone
 * arrives with those keys ABSENT while `InboxEntry` promises a string. The
 * inbox and search payloads land in state directly — they do not pass through
 * `normalizeEntry` — so that gap reached the UI: one keystroke in the CRM
 * search ran `entry.lead_number.toLowerCase()` over such an entry and threw.
 *
 * A spread rather than an allowlist, deliberately. `normalizeEntry` names every
 * field it keeps and drops the rest, which is right for a live patch rebuilt
 * from a partial payload and wrong here — these entries are already the correct
 * shape, and rebuilding them would strip whatever the allowlist has not caught
 * up to (close provenance, `ai_handler`).
 */
function withEntryStringDefaults(entry: InboxEntry): InboxEntry {
  return {
    ...entry,
    lead_name: entry.lead_name ?? "",
    lead_number: entry.lead_number ?? "",
    last_message_preview: entry.last_message_preview ?? "",
    last_message_type: entry.last_message_type ?? "user_message",
    last_message_sender: entry.last_message_sender ?? "",
    last_message_sender_avatar: entry.last_message_sender_avatar ?? "",
    business_phone_id: entry.business_phone_id ?? "",
  };
}

interface UseConversationWsOptions {
  token: string | null;
  campaignId?: string;
  campaignType?: CampaignType;
  enabled?: boolean;
}

export interface SendButtonWsInput {
  headerType?: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons: { id: string; title: string }[];
}

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
  typingUsers: Map<string, boolean>;
  totalUnread: number;
  loadHistory: () => void;
  loadingHistory: boolean;
  loadingConversation: boolean;
  loadAround: (timestamp: string) => void;
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
    /**
     * Narrows campaignId to a CAMPAIGN rather than the channel's primary
     * container. Only the unofficial WhatsApp channel has two — a conversation
     * belongs to a number forever, while a campaign is one run across many —
     * so everywhere else this stays undefined and nothing changes.
     */
    containerKind?: ContainerKind,
  ) => void;
  latestAnalysisUpdate: WsAnalysisUpdatePayload | null;
  assignTo: (entryId: string, entryType: string, userId: string) => void;
  setConversationStatus: (
    entryId: string,
    entryType: string,
    status: string,
  ) => void;
  applyLeadRename: (leadId: string, name: string) => void;

  /**
   * The conversations open in floating windows, keyed by entry.
   *
   * Separate from `activeConversation`, which stays what the centre pane
   * shows. Both ride this one socket and are fed by the same frames.
   */
  windowConversations: WindowConversations;
  /** Bumped on every open, so the deck can raise an already-open window. */
  windowFocusRequest: { key: string; nonce: number } | null;
  openConversationWindow: (input: OpenWindowConversationInput) => void;
  closeConversationWindow: (entryId: string, entryType: EntryType) => void;
  /** Parks or restores a window, which is what decides read vs unread. */
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
}

export type CallStatus = "waiting_slot" | "ringing" | "answered" | "ended";

export type CallEndReason =
  | "ended"
  | "failed"
  | "busy"
  | "no_answer"
  | "declined";

export interface CallState {
  callId?: string;
  entryId: string;
  entryType: EntryType;
  status: CallStatus;
  phoneNumber?: string;
  answeredAt?: number;
  endReason?: CallEndReason;
  durationSeconds?: number;
  leadName?: string;
  localAudioLevel?: number;
  remoteAudioLevel?: number;
}

interface PendingStatusChangeSnapshot {
  previousStatus?: string;
  previousInboxEntry: InboxEntry | null;
  previousSearchEntry: InboxEntry | null;
}

export function useConversationWs({
  token,
  campaignId = "",
  campaignType,
  enabled = true,
}: UseConversationWsOptions): UseConversationWsReturn {
  const { currentWorkspace } = useWorkspace();
  const { currentDepartment } = useDepartment();
  const workspaceId = currentWorkspace?.id ?? "";
  const departmentId = currentDepartment?.id ?? "";
  const scopeKey = `${workspaceId}:${departmentId}`;
  const [viewMode, setViewMode] = useState<ViewMode>(
    campaignId ? "campaign" : "global",
  );
  const [playNotification] = useSound("/audio/NOTIFICATION.mp3");

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [inbox, setInbox] = useState<InboxEntry[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<ActiveConversation | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, boolean>>(
    new Map(),
  );
  const [loadingHistory, setLoadingHistory] = useState(false);
  // True only for the initial open of a conversation (subscribe → first
  // history batch). Drives the thread skeleton; distinct from loadingHistory,
  // which covers paginating older messages / jump-to-message.
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
  const loadAroundRef = useRef(false);
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

  // Conversations open in floating windows, beside the one the centre pane
  // shows. Their thread semantics live in lib/conversations/windowed-
  // conversations, which is pure and tested without a socket; this hook only
  // feeds it frames and owns the wire.
  const [windowConversations, setWindowConversations] =
    useState<WindowConversations>(emptyWindowConversations);
  const windowConversationsRef = useRef<WindowConversations>(
    windowConversations,
  );
  // Lets the deck raise a window for a conversation opened again, which changes
  // no conversation state and would otherwise be invisible.
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
  const pendingStatusChangesRef = useRef<
    Map<string, PendingStatusChangeSnapshot>
  >(new Map());

  const intentionalDisconnectRef = useRef(false);
  const isConnectingRef = useRef(false);
  const loadingMoreRef = useRef(false);
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
  // One reconnect controller for the socket's lifetime: infinite capped backoff
  // + reconnect-on-visibility/online, so a backgrounded tab reconnects on return
  // instead of staying dead. Gated by shouldReconnect (enabled + authenticated).
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
  const currentViewRef = useRef<{
    campaignId: string;
    campaignType?: CampaignType;
    whatsAppCampaignType?: WhatsAppCampaignTypeFilter;
    containerKind?: ContainerKind;
    conversationStatus: string;
  }>({
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
  }, [activeConversation]);

  const rollbackPendingStatusChange = useCallback(
    (entryId: string, entryType: string, previousStatus?: string) => {
      const key = `${entryType}-${entryId}`;
      const snapshot = pendingStatusChangesRef.current.get(key);
      if (!snapshot) return;

      const restoredStatus = previousStatus ?? snapshot.previousStatus ?? "new";
      const activeStatusFilter = currentViewRef.current.conversationStatus;
      const shouldShowInInbox =
        !activeStatusFilter || restoredStatus === activeStatusFilter;

      setInbox((prev) => {
        const filtered = prev.filter(
          (entry) =>
            !(entry.entry_id === entryId && entry.entry_type === entryType),
        );

        if (!snapshot.previousInboxEntry || !shouldShowInInbox) {
          inboxRef.current = filtered;
          return filtered;
        }

        const restoredEntry = {
          ...snapshot.previousInboxEntry,
          conversation_status: restoredStatus,
        };
        const updated = [restoredEntry, ...filtered];
        inboxRef.current = updated;
        return updated;
      });

      setSearchResults((prev) => {
        if (!prev) return prev;

        const filtered = prev.filter(
          (entry) =>
            !(entry.entry_id === entryId && entry.entry_type === entryType),
        );
        const activeSearchStatus =
          currentSearchFiltersRef.current?.conversation_status;
        const shouldShowInSearch =
          !activeSearchStatus || restoredStatus === activeSearchStatus;

        if (!snapshot.previousSearchEntry || !shouldShowInSearch) {
          return filtered;
        }

        return [
          {
            ...snapshot.previousSearchEntry,
            conversation_status: restoredStatus,
          },
          ...filtered,
        ];
      });

      setActiveConversation((prev) =>
        prev && prev.entry_id === entryId && prev.entry_type === entryType
          ? { ...prev, conversation_status: restoredStatus }
          : prev,
      );

      pendingStatusChangesRef.current.delete(key);
    },
    [],
  );

  useEffect(() => {
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


  const send = useCallback((type: string, payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  /**
   * Which VIEWS are holding each open conversation.
   *
   * Views are named — "pane" for the centre pane, "window" for a floating one —
   * rather than counted. A count is wrong here because subscribing is not a
   * balanced operation: `subscribe()` is called again every time an operator
   * clicks the conversation they are already in, and each of those would raise
   * a counter that only ONE later switch decrements. The conversation then
   * never reaches zero, `unsubscribe` is never sent, and it keeps streaming
   * long after the operator has moved on — which is how a conversation nobody
   * was looking at was still being marked read.
   *
   * A set of names makes re-subscribing idempotent, which is exactly what the
   * caller means by it.
   */
  type SubscriptionHolder = "pane" | "window";
  const subscriptionHoldersRef = useRef<
    Map<
      string,
      { entryId: string; entryType: EntryType; holders: Set<SubscriptionHolder> }
    >
  >(new Map());

  const retainSubscription = useCallback(
    (entryId: string, entryType: EntryType, holder: SubscriptionHolder) => {
      const key = windowKey(entryId, entryType);
      const current = subscriptionHoldersRef.current.get(key);
      const holders = current?.holders ?? new Set<SubscriptionHolder>();
      holders.add(holder);
      subscriptionHoldersRef.current.set(key, { entryId, entryType, holders });

      // Sent on every retain, not only the first. Re-subscribing is cheap and
      // idempotent server-side, and it is what delivers the `subscribed` frame
      // the newly attached view needs to render.
      send("subscribe", { entry_id: entryId, entry_type: entryType });
    },
    [send],
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
    },
    [send],
  );


  const normalizeMessage = useCallback(
    (message: ConversationMessage | Record<string, unknown>) => {
      const msg = message as Record<string, unknown>;
      return {
        id: (msg.id as string) ?? "",
        entry_id: (msg.entry_id as string) ?? (msg.entryId as string) ?? "",
        entry_type:
          (msg.entry_type as EntryType) ?? (msg.entryType as EntryType),
        channel: (msg.channel as MessageChannel) ?? "whatsapp",
        message_type:
          (msg.message_type as string) ??
          (msg.messageType as string) ??
          "user_message",
        // Who sent it. Dropping this on the live push would leave a message
        // correctly placed on reload and on the wrong side of the thread the
        // moment it arrived — the worst of both, because it looks like a
        // rendering race rather than a missing field.
        direction: (msg.direction as ConversationMessage["direction"]) ??
          (msg.Direction as ConversationMessage["direction"]),
        from: (msg.from as string) ?? "",
        to: (msg.to as string) ?? "",
        text: (msg.text as string) ?? "",
        media_id: (msg.media_id as string) ?? (msg.mediaId as string),
        media_type:
          (msg.media_type as MediaType) ?? (msg.mediaType as MediaType),
        media_url: (msg.media_url as string) ?? (msg.mediaUrl as string),
        sender_name:
          (msg.sender_name as string) ?? (msg.senderName as string) ?? "",
        sender_avatar:
          (msg.sender_avatar as string) ?? (msg.senderAvatar as string),
        read: (msg.read as boolean) ?? false,
        read_at: (msg.read_at as string) ?? (msg.readAt as string) ?? null,
        read_by: (msg.read_by as string) ?? (msg.readBy as string) ?? null,
        delivery_status:
          (msg.delivery_status as string) ??
          (msg.deliveryStatus as string) ??
          undefined,
        reply_to_message_id:
          (msg.reply_to_message_id as string) ??
          (msg.replyToMessageId as string) ??
          undefined,
        metadata:
          (msg.metadata as ConversationMessage["metadata"]) ?? undefined,
        created_at:
          (msg.created_at as string) ?? (msg.createdAt as string) ?? "",
        updated_at:
          (msg.updated_at as string) ?? (msg.updatedAt as string) ?? "",
      } as ConversationMessage;
    },
    [],
  );

  /**
   * Rebuilds one inbox row from a live websocket payload.
   *
   * It is an ALLOWLIST, and that is its hazard: a field nobody remembered to add
   * here is silently dropped every time the server pushes an update, so the row
   * degrades in a live session and comes back correct on a page refresh — which
   * reads as a flickering bug rather than as a missing line of code.
   *
   * That has already happened twice. `lead_picture` was sent by the backend and
   * never copied, so an avatar vanished the moment a message arrived; `is_group`
   * was added and not copied, so a group conversation turned back into a person
   * — losing its glyph, its Grupo tab, and gaining a block button that addresses
   * a lead it does not have.
   *
   * When you add a field to InboxEntry, add it here too.
   */
  const normalizeEntry = useCallback(
    (raw: Record<string, unknown>): InboxEntry => {
      return {
        entry_id: (raw.entry_id as string) ?? (raw.entryId as string) ?? "",
        entry_type:
          (raw.entry_type as EntryType) ??
          (raw.entryType as EntryType) ??
          "whatsapp",
        // lead_id is what the memories tab and lead actions key on. Losing it
        // here is what made memories vanish the moment a live message replaced
        // the HTTP-loaded entry.
        lead_id:
          (raw.lead_id as string) ?? (raw.leadId as string) ?? undefined,
        lead_name: (raw.lead_name as string) ?? (raw.leadName as string) ?? "",
        lead_number:
          (raw.lead_number as string) ?? (raw.leadNumber as string) ?? "",
        lead_picture:
          (raw.lead_picture as string) ??
          (raw.leadPicture as string) ??
          undefined,
        // Omitted by the server when false, so `?? false` is the correct
        // reading of an absent key rather than a defensive default.
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
        window_open:
          (raw.window_open as boolean) ?? (raw.windowOpen as boolean) ?? false,
        window_expires_at:
          (raw.window_expires_at as string | null) ??
          (raw.windowExpiresAt as string | null) ??
          null,
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
        conversation_status:
          (raw.conversation_status as string) ??
          (raw.conversationStatus as string) ??
          undefined,
        available_stages:
          (raw.available_stages as InboxEntry["available_stages"]) ??
          (raw.availableStages as InboxEntry["available_stages"]) ??
          undefined,
      };
    },
    [],
  );

  /**
   * Feeds one frame to the floating windows, in addition to whatever the
   * centre pane does with it below.
   *
   * Messages are normalized first so the pure reducer never sees wire shapes,
   * and inbound messages a window is showing get their read receipt here — a
   * conversation is read when the operator can SEE it, which a window is just
   * as much as the centre pane.
   */
  const routeEventToWindows = useCallback(
    (event: WsServerEvent) => {
      if (windowConversationsRef.current.size === 0) return;

      let framed = event;
      let unreadIds: string[] = [];

      switch (event.type) {
        case "conversation:history": {
          const messages = (event.payload.messages ?? []).map(normalizeMessage);
          framed = {
            ...event,
            payload: { ...event.payload, messages },
          };
          unreadIds = incomingUnreadIds(messages);
          break;
        }
        case "conversation:message":
        case "conversation:message_sent": {
          const message = normalizeMessage(event.payload.message);
          framed = { ...event, payload: { ...event.payload, message } };
          if (event.type === "conversation:message") {
            unreadIds = incomingUnreadIds([message]);
          }
          break;
        }
      }

      const before = windowConversationsRef.current;
      const next = applyWindowEvent(before, framed);
      if (next !== before) {
        windowConversationsRef.current = next;
        setWindowConversations(next);

        // A frame can CLOSE a window — the conversation was assigned to
        // someone else and left this operator's scope, or the server
        // unsubscribed it. The subscription that window was holding has to go
        // with it, or the socket keeps streaming a thread nothing is showing.
        if (next.size < before.size) {
          for (const [key, state] of before) {
            if (next.has(key)) continue;
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

      /**
       * A receipt means "the operator has SEEN this", so only a window that is
       * actually on screen may send one.
       *
       * Holding the subscription is not the same as reading it. A window
       * parked in the dock still receives everything, and receipting there
       * marked conversations read that nobody had looked at — including,
       * confusingly, while the operator was working a different conversation
       * in the centre pane entirely. Those messages raise the window's unread
       * badge instead, and the receipts go out when it is restored.
       */
      const holder = next.get(windowKey(payload.entry_id, payload.entry_type));
      if (!holder?.visible) return;

      send("mark_read", {
        entry_id: payload.entry_id,
        entry_type: payload.entry_type,
        message_ids: unreadIds,
      });
    },
    [normalizeMessage, releaseSubscription, send],
  );

  const handleServerEvent = useCallback(
    (event: WsServerEvent) => {
      routeEventToWindows(event);

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
          playNotification();
          const updated = normalizeEntry(
            event.payload.entry as unknown as Record<string, unknown>,
          );
          // An update that arrives without a lead_id must not unlink a lead the
          // loaded entry already knows: the linkage only ever grows, it does
          // not disappear because one broadcast omitted the field.
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

            const filtered = prev.filter(
              (e) =>
                !(
                  e.entry_id === updated.entry_id &&
                  e.entry_type === updated.entry_type
                ),
            );
            const newInbox = [withLead(oldEntry), ...filtered];
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

            const filtered = prev.filter(
              (e) =>
                !(
                  e.entry_id === updated.entry_id &&
                  e.entry_type === updated.entry_type
                ),
            );

            return existed ? [withLead(oldSearchEntry), ...filtered] : prev;
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
            closed_at,
          } = event.payload;
          const closePatch = {
            conversation_status: status,
            ...(close_source !== undefined ? { close_source } : {}),
            ...(close_reason !== undefined ? { close_reason } : {}),
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
          pendingStatusChangesRef.current.delete(`${entry_type}-${entry_id}`);
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
          break;
        }

        case "conversation:subscribed": {
          const {
            entry_id,
            entry_type,
            lead_name,
            lead_number,
            lead_metadata,
            unread_count,
            window_open,
            window_expires_at,
            window_closed_reason,
            automation_enabled,
          } = event.payload;

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
              return {
                ...prev,
                lead_name: lead_name ?? prev.lead_name,
                lead_number: lead_number ?? prev.lead_number,
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
                window_closed_reason:
                  window_closed_reason ?? prev.window_closed_reason ?? null,
                automation_enabled: resolveAutomationEnabled(
                  automation_enabled,
                  inboxEntry?.automation_enabled,
                  prev.automation_enabled,
                ),
                conversation_status:
                  inboxEntry?.conversation_status ?? prev.conversation_status,
              };
            }

            return {
              entry_id,
              entry_type,
              campaign_id: inboxEntry?.campaign_id,
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
              window_closed_reason: window_closed_reason ?? null,
              automation_enabled: resolveAutomationEnabled(
                automation_enabled,
                inboxEntry?.automation_enabled,
              ),
              conversation_status: inboxEntry?.conversation_status,
            };
          });

          break;
        }

        case "conversation:history": {
          const {
            entry_id,
            entry_type,
            messages: rawHistory,
            has_more,
            total,
          } = event.payload;
          const historyMessages = (rawHistory ?? []).map(normalizeMessage);
          const isJump = loadAroundRef.current;
          loadAroundRef.current = false;
          const isLoadMore = loadingMoreRef.current;
          loadingMoreRef.current = false;
          setLoadingHistory(false);
          stopLoadingConversation();

          setActiveConversation((prev) => {
            if (!prev) return null;
            if (prev.entry_id !== entry_id || prev.entry_type !== entry_type)
              return prev;

            const isInitialLoad = prev.messages.length === 0;

            if (isInitialLoad || isJump) {
              return {
                ...prev,
                messages: historyMessages,
                has_more,
                ...(total !== undefined ? { total } : {}),
              };
            }

            if (isLoadMore) {
              return {
                ...prev,
                messages: [...historyMessages, ...prev.messages],
                has_more,
                ...(total !== undefined ? { total } : {}),
              };
            }

            const existingIds = new Set(prev.messages.map((m) => m.id));
            const newMsgs = historyMessages.filter(
              (m) => !existingIds.has(m.id),
            );
            if (newMsgs.length === 0) {
              return prev;
            }
            const merged = [...prev.messages, ...newMsgs].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
            );
            return {
              ...prev,
              messages: merged,
              has_more: prev.has_more, // keep user's scroll-up state
              ...(total !== undefined ? { total } : {}),
            };
          });

          if (
            activeSubscriptionRef.current?.entry_id === entry_id &&
            activeSubscriptionRef.current?.entry_type === entry_type
          ) {
            const outgoingTypes = new Set([
              "operator",
              "ai_response",
              "tool_call",
              "tool_result",
              "system",
            ]);
            const unreadIds = historyMessages
              .filter((m) => !m.read && !outgoingTypes.has(m.message_type))
              .map((m) => m.id);
            if (unreadIds.length > 0) {
              send("mark_read", {
                entry_id,
                entry_type,
                message_ids: unreadIds,
              });
            }
          }
          break;
        }

        case "conversation:message": {
          const { entry_id, entry_type, message } = event.payload;
          const normalized = normalizeMessage(message);

          if (
            activeSubscriptionRef.current?.entry_id === entry_id &&
            activeSubscriptionRef.current?.entry_type === entry_type
          ) {
            setActiveConversation((prev) => {
              if (!prev) return null;
              if (prev.messages.some((m) => m.id === normalized.id))
                return prev;
              return {
                ...prev,
                messages: [...prev.messages, normalized],
              };
            });

            const outgoingTypes = new Set([
              "operator",
              "ai_response",
              "tool_call",
              "tool_result",
              "system",
            ]);
            if (
              !normalized.read &&
              !outgoingTypes.has(normalized.message_type)
            ) {
              send("mark_read", {
                entry_id,
                entry_type,
                message_ids: [normalized.id],
              });
            }
          }
          break;
        }

        case "conversation:message_sent": {
          const { entry_id, entry_type, message } = event.payload;
          const normalized = normalizeMessage(message);
          if (
            activeSubscriptionRef.current?.entry_id === entry_id &&
            activeSubscriptionRef.current?.entry_type === entry_type
          ) {
            setActiveConversation((prev) => {
              if (!prev) return null;
              const exists = prev.messages.some((m) => m.id === normalized.id);
              if (exists) return prev;
              return {
                ...prev,
                messages: [...prev.messages, normalized],
              };
            });
          }
          break;
        }

        case "conversation:message_error": {
          console.error("[ConversationWS] Message error:", event.payload.error);
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
          const { user_id, is_typing } = event.payload;
          setTypingUsers((prev) => {
            const next = new Map(prev);
            if (is_typing) {
              next.set(user_id, true);
            } else {
              next.delete(user_id);
            }
            return next;
          });
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

        case "conversation:unsubscribed": {
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
            messages: rawMessages,
            page,
            total_pages,
            total_items,
            query,
          } = event.payload;
          const normalized = (rawMessages ?? []).map(normalizeMessage);
          setMessageSearchResults(normalized);
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

        case "conversation:analysis_update": {
          const { entry_id, entry_type, analysis } = event.payload;
          setLatestAnalysisUpdate(event.payload);
          setInbox((prev) =>
            prev.map((e) =>
              e.entry_id === entry_id && e.entry_type === entry_type
                ? { ...e, latest_analysis: analysis }
                : e,
            ),
          );
          setFunnelColumns((prev) => {
            let changed = false;
            const newMap = new Map(prev);
            for (const [stageId, col] of newMap) {
              if (!col?.entries) continue;
              const idx = col.entries.findIndex(
                (e) => e.entry_id === entry_id && e.entry_type === entry_type,
              );
              if (idx !== -1) {
                changed = true;
                const updatedEntries = [...col.entries];
                updatedEntries[idx] = {
                  ...updatedEntries[idx],
                  latest_analysis: analysis,
                };
                newMap.set(stageId, { ...col, entries: updatedEntries });
              }
            }
            return changed ? newMap : prev;
          });
          break;
        }

        case "conversation:error": {
          console.error("[ConversationWS] Server error:", event.payload);
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
            toast.error(
              event.payload.message ||
                "Não foi possível atualizar o status da conversa.",
            );
            break;
          }
          switch (event.payload.code) {
            case "insufficient_balance":
              toast.error(
                "Ação não permitida: saldo insuficiente. Por favor, recarregue seu saldo para continuar.",
              );
              break;
          }
          break;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [send, routeEventToWindows],
  );


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
        /* ignore */
      }
      wsRef.current = null;
    }

    // Auth rides the httpOnly cookie on the WS handshake (attached same-site by
    // the browser); the access token is no longer placed in the URL. Session
    // presence was already gated above via `token`.
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

      // Reset backoff only after the connection stays up a while, so a flapping
      // socket doesn't reset to the base delay every cycle.
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

      // EVERY conversation still on screen comes back, not just the centre
      // pane's: a dropped socket must not leave three open windows dead while
      // the fourth one recovers.
      if (wasReconnect) {
        for (const { entryId, entryType } of subscriptionHoldersRef.current.values()) {
          ws.send(
            JSON.stringify({
              type: "subscribe",
              payload: { entry_id: entryId, entry_type: entryType },
            }),
          );
        }
      }
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

      loadingMoreRef.current = false;
      loadAroundRef.current = false;
      setLoadingHistory(false);
      if (loadingConversationTimerRef.current) {
        clearTimeout(loadingConversationTimerRef.current);
        loadingConversationTimerRef.current = null;
      }
      setLoadingConversation(false);

      // Same for the floating windows: a dropped socket must not leave four
      // spinners turning forever. Their subscriptions are kept, so the
      // reconnect above brings every one of them back.
      const settled = clearWindowLoading(windowConversationsRef.current);
      if (settled !== windowConversationsRef.current) {
        windowConversationsRef.current = settled;
        setWindowConversations(settled);
      }

      // The controller decides whether/when to retry (infinite capped backoff,
      // gated by shouldReconnect).
      controllerRef.current?.scheduleReconnect();
    };
  }, [handleServerEvent]);

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

  // Socket lifecycle is keyed ONLY on the stable connection scope
  // (enabled + token presence + workspace + department). It deliberately does
  // NOT depend on campaignId/campaignType, campaign and filter switches happen
  // over the same socket via switchView(), so reconnecting on them would be a
  // wasteful teardown. It also goes through connectRef/disconnectRef instead of
  // the connect/disconnect callbacks so a re-render that changes their identity
  // can never tear down and recreate the socket (the reconnect-on-render storm).
  const hasToken = !!token;
  useEffect(() => {
    if (enabled && hasToken && workspaceId) {
      // Attach visibility/online reconnect listeners for the socket's life.
      controllerRef.current?.start();
      const connectTimeout = setTimeout(() => {
        connectRef.current?.();
      }, 50);

      return () => {
        clearTimeout(connectTimeout);
        disconnectRef.current?.();
        setActiveConversation(null);
        activeSubscriptionRef.current = null;
      };
    } else {
      disconnectRef.current?.();
      setActiveConversation(null);
      activeSubscriptionRef.current = null;
    }
  }, [enabled, hasToken, workspaceId, departmentId]);


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

      activeSubscriptionRef.current = {
        entry_id: entryId,
        entry_type: entryType,
      };

      // Retain BEFORE releasing the previous one: if both views were showing
      // the same entry the count never touches zero, so no `unsubscribe` is
      // sent for a conversation still on screen.
      retainSubscription(entryId, entryType, "pane");
      if (isSwitch) {
        releaseSubscription(previous.entry_id, previous.entry_type, "pane");
      }

      // Show the thread skeleton while the first history batch loads, but not
      // when re-opening a conversation we already have cached in memory.
      const active = activeConversationRef.current;
      const alreadyLoaded =
        active?.entry_id === entryId &&
        active?.entry_type === entryType &&
        active.messages.length > 0;
      if (!alreadyLoaded) {
        if (loadingConversationTimerRef.current) {
          clearTimeout(loadingConversationTimerRef.current);
        }
        setLoadingConversation(true);
        // Safety net: never leave the skeleton up forever if history never
        // arrives (dropped socket, backend hiccup).
        loadingConversationTimerRef.current = setTimeout(() => {
          loadingConversationTimerRef.current = null;
          setLoadingConversation(false);
        }, 12000);
      }

      // `subscribe` itself is sent by retainSubscription above.
    },
    [retainSubscription, releaseSubscription],
  );

  const unsubscribe = useCallback(() => {
    if (activeSubscriptionRef.current) {
      releaseSubscription(
        activeSubscriptionRef.current.entry_id,
        activeSubscriptionRef.current.entry_type,
        "pane",
      );
      setActiveConversation(null);
      activeSubscriptionRef.current = null;
    }
    stopLoadingConversation();
  }, [releaseSubscription, stopLoadingConversation]);

  const sendMessage = useCallback(
    (text: string, signed: boolean, replyToMessageId?: string) => {
      if (!activeSubscriptionRef.current) return;
      console.log("signed? :", signed);
      send("send", {
        entry_id: activeSubscriptionRef.current.entry_id,
        entry_type: activeSubscriptionRef.current.entry_type,
        signed: signed,
        text,
        ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
      });
    },
    [send],
  );

  const sendMediaMessage = useCallback(
    (
      text: string,
      mediaId: string,
      mediaType: MediaType,
      signed: boolean,
      replyToMessageId?: string,
    ) => {
      if (!activeSubscriptionRef.current) return;
      console.log("[WS] Sending media message:", {
        mediaId,
        mediaType,
        text: text.substring(0, 50),
        replyToMessageId,
      });
      send("send", {
        entry_id: activeSubscriptionRef.current.entry_id,
        entry_type: activeSubscriptionRef.current.entry_type,
        text,
        media_id: mediaId,
        signed: signed,
        media_type: mediaType,
        ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
      });
    },
    [send],
  );

  const sendButtonMessage = useCallback(
    (input: SendButtonWsInput, replyToMessageId?: string) => {
      if (!activeSubscriptionRef.current) return;
      send("send_button", {
        entry_id: activeSubscriptionRef.current.entry_id,
        entry_type: activeSubscriptionRef.current.entry_type,
        header_type: input.headerType || "",
        header_text: input.headerText || "",
        body_text: input.bodyText,
        footer_text: input.footerText || "",
        buttons: input.buttons,
        ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
      });
    },
    [send],
  );

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

  const loadHistory = useCallback(() => {
    if (!activeSubscriptionRef.current || loadingHistory) return;
    setActiveConversation((prev) => {
      if (!prev || prev.messages.length === 0 || !prev.has_more) return prev;
      const oldestMessage = prev.messages[0];
      loadingMoreRef.current = true;
      setLoadingHistory(true);
      send("load_history", {
        entry_id: activeSubscriptionRef.current!.entry_id,
        entry_type: activeSubscriptionRef.current!.entry_type,
        before: oldestMessage.created_at,
      });
      return prev;
    });
  }, [send, loadingHistory]);

  const loadAround = useCallback(
    (timestamp: string) => {
      if (!activeSubscriptionRef.current) return;
      loadAroundRef.current = true;
      setLoadingHistory(true);
      send("load_around", {
        entry_id: activeSubscriptionRef.current.entry_id,
        entry_type: activeSubscriptionRef.current.entry_type,
        timestamp,
      });
    },
    [send],
  );

  // --- Conversations open in floating windows ---------------------------
  //
  // Every one of these is addressed by entry rather than by "whatever is
  // current", which is what lets several be open and worked at once.

  const applyWindows = useCallback(
    (next: WindowConversations) => {
      if (next === windowConversationsRef.current) return;
      windowConversationsRef.current = next;
      setWindowConversations(next);
    },
    [],
  );

  const openConversationWindow = useCallback(
    (input: OpenWindowConversationInput) => {
      if (!input.entryId || !input.entryType) return;
      const key = windowKey(input.entryId, input.entryType);
      const current = windowConversationsRef.current;
      const alreadyOpen = current.has(key);

      // The cap lives here because this map is the list a window is derived
      // from. A Map iterates in insertion order, so the first key is the one
      // opened longest ago — the one that gives way.
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
          next = closeWindowConversation(next, oldestKey);
        }
      }

      applyWindows(openWindowConversation(next, input));

      if (retired) releaseSubscription(retired.entryId, retired.entryType, "window");
      // A window already open is being re-focused, and it is already holding
      // its subscription; retaining again would leak a holder that no close
      // will ever release.
      if (!alreadyOpen) {
        retainSubscription(input.entryId, input.entryType, "window");

        // Ask for the transcript explicitly rather than relying on the one
        // that rides the subscribe reply.
        //
        // The server remembers which messages it has already sent each
        // CONNECTION per entry, and filters them out of a subscribe's history.
        // That is right when one socket shows one conversation — a re-subscribe
        // then means "I still have these" — but a window is a SECOND view on
        // the same socket, and it starts empty. Without this it opens blank for
        // any conversation the centre pane has already shown.
        //
        // `load_history` is not filtered, and asking for what came before NOW
        // is how you ask for the newest page. The reducer merges by message id,
        // so this frame and the subscribe's own history can arrive in either
        // order, or both, without duplicating a line.
        send("load_history", {
          entry_id: input.entryId,
          entry_type: input.entryType,
          before: new Date().toISOString(),
        });
      }

      // Bumped even for a window already open, so picking that conversation
      // again brings its window forward rather than appearing to do nothing.
      windowFocusNonceRef.current += 1;
      setWindowFocusRequest({ key, nonce: windowFocusNonceRef.current });
    },
    [applyWindows, releaseSubscription, retainSubscription, send],
  );

  const closeConversationWindow = useCallback(
    (entryId: string, entryType: EntryType) => {
      const key = windowKey(entryId, entryType);
      if (!windowConversationsRef.current.has(key)) return;
      applyWindows(closeWindowConversation(windowConversationsRef.current, key));
      releaseSubscription(entryId, entryType, "window");
    },
    [applyWindows, releaseSubscription],
  );

  /**
   * Parks or restores a window, as far as READING is concerned.
   *
   * The deck owns whether a window is minimized; this is that fact reaching the
   * socket, because it decides whether arriving messages are receipted as read
   * or counted as unread. Restoring one sends the receipts that were held back
   * while it sat in the dock.
   */
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
    (
      entryId: string,
      entryType: EntryType,
      text: string,
      signed: boolean,
      replyToMessageId?: string,
    ) => {
      send("send", {
        entry_id: entryId,
        entry_type: entryType,
        signed,
        text,
        ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
      });
    },
    [send],
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
      send("send", {
        entry_id: entryId,
        entry_type: entryType,
        text,
        media_id: mediaId,
        media_type: mediaType,
        signed,
        ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
      });
    },
    [send],
  );

  const windowSendButton = useCallback(
    (
      entryId: string,
      entryType: EntryType,
      input: SendButtonWsInput,
      replyToMessageId?: string,
    ) => {
      send("send_button", {
        entry_id: entryId,
        entry_type: entryType,
        header_type: input.headerType || "",
        header_text: input.headerText || "",
        body_text: input.bodyText,
        footer_text: input.footerText || "",
        buttons: input.buttons,
        ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
      });
    },
    [send],
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

  const windowLoadHistory = useCallback(
    (entryId: string, entryType: EntryType) => {
      const key = windowKey(entryId, entryType);
      const state = windowConversationsRef.current.get(key);
      if (!state || state.loadingHistory) return;

      const { messages, has_more } = state.conversation;
      if (messages.length === 0 || !has_more) return;

      applyWindows(markWindowLoadingMore(windowConversationsRef.current, key));
      send("load_history", {
        entry_id: entryId,
        entry_type: entryType,
        before: messages[0].created_at,
      });
    },
    [applyWindows, send],
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
      send("assign_to", {
        entry_id: entryId,
        entry_type: entryType,
        user_id: userId,
      });
    },
    [send],
  );

  /**
   * Reflects a lead rename across every list already on screen.
   *
   * A lead can own several conversations — official WhatsApp entries across
   * campaigns and an unofficial WhatsApp conversation — and renaming the
   * person means all of those lead-backed rows are now that name. Keyed on
   * lead_id rather than entry_id for exactly that reason: renaming from one
   * conversation and watching the row above it keep the old name would read as
   * a failed save.
   *
   * Local only. The write already succeeded server-side by the time this runs;
   * this is what spares the operator a reload.
   */
  const applyLeadRename = useCallback((leadId: string, name: string) => {
    if (!leadId) return;

    const rename = (entries: InboxEntry[]) =>
      entries.map((entry) =>
        entry.lead_id === leadId ? { ...entry, lead_name: name } : entry,
      );

    // The open conversation carries no lead_id of its own, so it is matched
    // through the refs rather than through the updaters above — a Set filled
    // inside one setState updater is not reliably readable from another.
    const owned = new Set(
      [...inboxRef.current, ...(searchResultsRef.current ?? [])]
        .filter((entry) => entry.lead_id === leadId)
        .map((entry) => `${entry.entry_type}-${entry.entry_id}`),
    );

    setInbox((prev) => {
      const updated = rename(prev);
      inboxRef.current = updated;
      return updated;
    });
    setSearchResults((prev) => {
      if (!prev) return prev;
      const updated = rename(prev);
      searchResultsRef.current = updated;
      return updated;
    });
    setFunnelColumns((prev) => {
      let changed = false;
      const updated = new Map(prev);
      for (const [stageId, column] of prev) {
        let columnChanged = false;
        const entries = column.entries.map((entry) => {
          if (entry.lead_id !== leadId) return entry;
          columnChanged = true;
          changed = true;
          return { ...entry, lead_name: name };
        });
        if (columnChanged) updated.set(stageId, { ...column, entries });
      }
      return changed ? updated : prev;
    });

    setActiveConversation((prev) =>
      prev && owned.has(`${prev.entry_type}-${prev.entry_id}`)
        ? { ...prev, lead_name: name }
        : prev,
    );
  }, []);

  const setConversationStatus = useCallback(
    (entryId: string, entryType: string, status: string) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        toast.error("A conexão do chat não está pronta. Tente novamente.");
        return;
      }

      const entryKey = `${entryType}-${entryId}`;
      const previousInboxEntry =
        inboxRef.current.find(
          (entry) =>
            entry.entry_id === entryId && entry.entry_type === entryType,
        ) ?? null;
      const previousSearchEntry =
        searchResultsRef.current?.find(
          (entry) =>
            entry.entry_id === entryId && entry.entry_type === entryType,
        ) ?? null;
      const previousStatus =
        previousInboxEntry?.conversation_status ??
        previousSearchEntry?.conversation_status ??
        activeConversationRef.current?.conversation_status;

      pendingStatusChangesRef.current.set(entryKey, {
        previousStatus,
        previousInboxEntry,
        previousSearchEntry,
      });

      // Optimistic close provenance for human menu finish (server confirms via WS).
      const statusPatch =
        status === "finished"
          ? {
              conversation_status: status,
              close_source: "human" as const,
              close_reason: "manual" as const,
              closed_at: new Date().toISOString(),
            }
          : { conversation_status: status };

      setInbox((prev) => {
        const idx = prev.findIndex(
          (e) => e.entry_id === entryId && e.entry_type === entryType,
        );
        if (idx < 0) return prev;

        const activeStatusFilter = currentViewRef.current.conversationStatus;
        if (activeStatusFilter && status !== activeStatusFilter) {
          const filtered = prev.filter(
            (e) => !(e.entry_id === entryId && e.entry_type === entryType),
          );
          inboxRef.current = filtered;
          return filtered;
        }

        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...statusPatch };
        inboxRef.current = updated;
        return updated;
      });
      setSearchResults((prev) => {
        if (!prev) return prev;

        const idx = prev.findIndex(
          (e) => e.entry_id === entryId && e.entry_type === entryType,
        );
        if (idx < 0) return prev;

        const activeSearchStatus =
          currentSearchFiltersRef.current?.conversation_status;
        if (activeSearchStatus && status !== activeSearchStatus) {
          return prev.filter(
            (e) => !(e.entry_id === entryId && e.entry_type === entryType),
          );
        }

        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...statusPatch };
        return updated;
      });
      setActiveConversation((prev) =>
        prev && prev.entry_id === entryId && prev.entry_type === entryType
          ? { ...prev, ...statusPatch }
          : prev,
      );
      send("set_conversation_status", {
        entry_id: entryId,
        entry_type: entryType,
        status,
      });
    },
    [send],
  );

  const switchView = useCallback(
    (
      newCampaignId?: string,
      newCampaignType?: CampaignType,
      newWhatsAppCampaignType?: WhatsAppCampaignTypeFilter,
      newConversationStatus?: string,
      newContainerKind?: ContainerKind,
    ) => {
      const previousView = currentViewRef.current;
      const resolvedConversationStatus =
        newConversationStatus ?? previousView.conversationStatus;
      const resolvedCampaignId = newCampaignId ?? "";
      const resolvedCampaignType = newCampaignType ?? "";
      const resolvedWhatsAppCampaignType = newWhatsAppCampaignType ?? "";
      const resolvedContainerKind = newContainerKind ?? "";
      const onlyStatusChanged =
        previousView.campaignId === resolvedCampaignId &&
        (previousView.campaignType ?? "") === resolvedCampaignType &&
        (previousView.whatsAppCampaignType ?? "") ===
          resolvedWhatsAppCampaignType &&
        // A container-kind change is a different set of conversations, so it is
        // never "only the status changed" — treating it as one would keep the
        // previous scope's inbox on screen.
        (previousView.containerKind ?? "") === resolvedContainerKind &&
        previousView.conversationStatus !== resolvedConversationStatus;

      currentViewRef.current = {
        campaignId: resolvedCampaignId,
        campaignType: newCampaignType,
        whatsAppCampaignType: newWhatsAppCampaignType,
        containerKind: newContainerKind,
        conversationStatus: resolvedConversationStatus,
      };

      send("switch_view", {
        campaign_id: resolvedCampaignId,
        campaign_type: resolvedCampaignType,
        whatsapp_campaign_type: resolvedWhatsAppCampaignType,
        container_kind: resolvedContainerKind,
        conversation_status: resolvedConversationStatus,
      });

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

  return {
    status,
    inbox,
    connectedUsers,
    activeConversation,
    subscribe,
    unsubscribe,
    sendMessage,
    sendMediaMessage,
    sendButtonMessage,
    markRead,
    sendTyping,
    typingUsers,
    totalUnread,
    loadHistory,
    loadAround,
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
    setConversationStatus,
    applyLeadRename,
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
  };
}

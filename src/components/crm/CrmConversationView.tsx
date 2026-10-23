"use client";

import type {
  ActiveConversation,
  ConversationMessage,
  EntryType,
  InboxEntryLabel,
  Label,
  Stage,
} from "@/lib/conversations/types";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CircuitBoard } from "@/components/brand/circuit";
import { LightPool } from "@/components/brand/light-pool";
import { ArrowDown, Image as ImageIcon } from "@/components/icons";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useThreadAnchor } from "@/hooks/use-thread-anchor";
import { useLiveAnnouncement } from "@/hooks/use-live-announcement";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useMessageActions } from "@/hooks/use-message-actions";
import { startEditing, stopEditing, useEditingMessage } from "@/hooks/use-message-editing";
import { useConversationNotes } from "@/hooks/use-conversation-notes";
import { useConversationToolCalls } from "@/hooks/use-conversation-tool-calls";
import { useConversationPresence } from "@/hooks/use-conversation-presence";
import { visibleNotes } from "@/lib/conversations/notes";
import { latestAutomationMessageId, visibleToolCalls } from "@/lib/conversations/agent-tool-calls";
import { windowKey } from "@/lib/conversations/window-deck";

import type { AgentToolDefinition } from "@/lib/agents/types";
import ConversationAnalysisPanel from "@/components/crm/ConversationAnalysisPanel";
import MoveToFunnelDialog from "@/components/crm/MoveToFunnelDialog";
import type { FunnelStages } from "@/app/actions/stages";
import { AdOriginBanner } from "./ad-origin-banner";
import { MercadoLivreSaleSummary } from "@/components/mercadolivre/mercadolivre-sale-summary";
import { latestEmailSubject } from "@/lib/email/subject";
import { cn } from "@/lib/utils";
import { getAgentToolsAction } from "@/app/actions/agents";
import { useTranslations } from "next-intl";
import type { LiveRead } from "@/lib/live-decisions/types";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { idleArrivals, trackArrivals } from "@/lib/conversations/live-arrivals";
import { stateTransition } from "@/lib/motion/tokens";
import { buildThreadRows, daySections } from "@/lib/conversations/thread-rows";
import { noUnreadBoundary, trackUnreadBoundary } from "@/lib/conversations/unread-boundary";
import { holdThread, noThreadHold } from "@/lib/conversations/thread-hold";
import { countUnseen } from "@/lib/conversations/scroll-anchor";
import { galleryItems } from "@/lib/conversations/media-gallery";
import type { Announcement } from "@/lib/conversations/live-announcement";
import type { HistoryAnchor } from "@/lib/conversations/history-anchor";
import { emptyOutbox, pendingBubbles, resendingMessageIds, type Outbox } from "@/lib/conversations/outbox";
import { foldResent, withPendingBubbles } from "@/lib/conversations/thread-merge";
import { toolDisplayName, type ToolDefinitionByName } from "@/lib/conversations/tool-events";
import { useAgentNamesById } from "@/app/[locale]/dashboard/workflows/_components/run-bits";
import { ThreadRowProvider, useThreadToolCopy, type ThreadRowContextValue } from "./thread/thread-context";
import { ThreadRowView } from "./thread/ThreadRowView";
import { AgentToolCallNamesProvider, AgentToolCallsLoadError, type AgentToolCallNames } from "./thread/AgentToolCallRow";
import { EntryMetadataPanel } from "./thread/EntryMetadataPanel";
import { LabelControl, SearchTrigger, StageControl } from "./thread/ThreadControls";
import { ThreadSearchBar } from "./thread/ThreadSearchBar";
import { MediaGalleryProvider } from "./thread/MediaGallery";
import { TypingIndicator } from "./thread/message-parts";

const NO_MESSAGES: ConversationMessage[] = [];
const NO_IDS: ReadonlySet<string> = new Set();
const JUMP_FLASH_MS = 2000;
const DEEP_LINK_FLASH_MS = 2500;
const NEWER_PAGE_DISTANCE_PX = 60;

type FlashTone = "warning" | "info";

const FLASH_CLASSES: Record<FlashTone, string[]> = {
  warning: ["ring-2", "ring-warning", "ring-offset-1"],
  info: ["ring-2", "ring-info", "ring-offset-1"],
};

interface JumpTarget {
  id: string;
  tone: FlashTone;
  aroundRequested: boolean;
}

type PagingDirection = "older" | "newer" | null;

interface DeepLink {
  timestamp: string;
  revealed: boolean;
  aroundRequested: boolean;
}

function flashElement(element: Element, tone: FlashTone, durationMs: number, done?: () => void) {
  element.classList.add(...FLASH_CLASSES[tone]);
  setTimeout(() => {
    element.classList.remove(...FLASH_CLASSES[tone]);
    done?.();
  }, durationMs);
}

function findMessageElement(container: HTMLElement, id: string): Element | null {
  return container.querySelector(`[data-msg-id="${CSS.escape(id)}"]`);
}

function threadKeyOf(conversation: ActiveConversation | null): string | null {
  return conversation ? `${conversation.entry_type}:${conversation.entry_id}` : null;
}

interface CrmConversationViewProps {
  conversation: ActiveConversation | null;
  isTyping: boolean;
  onLoadMore?: () => void;
  loadingHistory?: boolean;
  loadingConversation?: boolean;
  translations: {
    noConversationSelected: string;
    noConversationDescription: string;
    loadingMore: string;
    windowClosed: string;
    windowClosedDescription: string;
    noPermissionStageAssign?: string;
  };
  onSearchMessages?: (query: string, page?: number) => void;
  onClearMessageSearch?: () => void;
  messageSearchResults?: ConversationMessage[] | null;
  searchingMessages?: boolean;
  messageSearchTotalItems?: number;
  messageSearchQuery?: string | null;
  scrollToMessageTimestamp?: string | null;
  onScrolledToMessage?: () => void;
  onLoadAround?: (anchor: HistoryAnchor) => void;
  onLoadNewer?: () => void;
  onReturnToPresent?: () => void;
  outbox?: Outbox;
  onRetrySend?: (requestId: string) => void;
  onResendMessage?: (messageId: string) => void;
  onReply?: (message: ConversationMessage) => void;
  tags?: Stage[];
  currentEntryTags?: { stage_id: string; name: string; color: string }[];
  entryAvailableTags?: { stage_id: string; name: string; color: string }[];
  liveRead?: LiveRead | null;
  funnelStages?: FunnelStages[];
  onMoveToFunnel?: (
    entryId: string,
    entryType: EntryType,
    stageId: string,
  ) => Promise<string | null>;
  onEntryStageChange?: (
    entryId: string,
    entryType: EntryType,
    newTagId: string,
    oldTagId: string | null,
  ) => void;
  onAssignStage?: (
    stageId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  availableLabels?: Label[];
  currentEntryLabels?: InboxEntryLabel[];
  onAssignLabel?: (
    labelId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  onRemoveLabel?: (
    labelId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
}

export default function CrmConversationView({
  conversation,
  isTyping,
  onLoadMore,
  loadingHistory = false,
  loadingConversation = false,
  translations: t,
  onSearchMessages,
  onClearMessageSearch,
  messageSearchResults,
  searchingMessages = false,
  messageSearchTotalItems = 0,
  scrollToMessageTimestamp,
  onScrolledToMessage,
  onLoadAround,
  onLoadNewer,
  onReturnToPresent,
  outbox = emptyOutbox,
  onRetrySend,
  onResendMessage,
  onReply,
  tags = [],
  currentEntryTags = [],
  entryAvailableTags = [],
  liveRead = null,
  funnelStages = [],
  onMoveToFunnel,
  onEntryStageChange,
  onAssignStage,
  availableLabels = [],
  currentEntryLabels = [],
  onAssignLabel,
  onRemoveLabel,
}: CrmConversationViewProps) {
  const tCrm = useTranslations("crm");
  const tThread = useTranslations("crmConversation.thread");
  const reduceMotion = useReducedMotion();
  const liveKey = threadKeyOf(conversation);

  const [hold, setHold] = useState(noThreadHold<ActiveConversation>);
  const currentHold = holdThread(hold, liveKey, conversation, loadingConversation);
  if (currentHold !== hold) setHold(currentHold);
  const shown = currentHold.shown;
  const shownKey = currentHold.key;
  const waiting = currentHold.waiting;
  const shownMessages = shown?.messages ?? NO_MESSAGES;
  const bubbleChannel = shownMessages[shownMessages.length - 1]?.channel ?? "whatsapp";
  const bubbles = useMemo(
    () => (shown ? pendingBubbles(outbox, shown.entry_id, shown.entry_type, bubbleChannel) : NO_MESSAGES),
    [outbox, shown, bubbleChannel],
  );
  const threadMessages = useMemo(() => withPendingBubbles(foldResent(shownMessages), bubbles), [shownMessages, bubbles]);
  const arrivalCandidates = useMemo(() => threadMessages.filter((message) => !message.client_request_id), [threadMessages]);
  const shownEntryType = shown?.entry_type;
  const emailSubject = useMemo(
    () => (shownEntryType === "email" ? latestEmailSubject(threadMessages) : null),
    [shownEntryType, threadMessages],
  );
  const resendingIds = useMemo(
    () => (shown ? resendingMessageIds(outbox, shown.entry_id, shown.entry_type) : NO_IDS),
    [outbox, shown],
  );

  const [showScrollDown, setShowScrollDown] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [arrivals, setArrivals] = useState(idleArrivals);
  if (arrivals.source !== arrivalCandidates || arrivals.threadKey !== shownKey) {
    const next = trackArrivals(arrivals, shownKey, arrivalCandidates);
    setArrivals(next);
    const sameThread = arrivals.threadKey === shownKey;
    setUnseen(sameThread ? countUnseen(unseen, next.live.size, showScrollDown) : 0);
    if (!sameThread) setShowScrollDown(false);
  }
  const arrivalStart = useCallback(
    (messageId: string) => (!reduceMotion && arrivals.live.has(messageId) ? { opacity: 0 } : false),
    [reduceMotion, arrivals.live],
  );

  const [unreadBoundary, setUnreadBoundary] = useState(noUnreadBoundary);
  const currentBoundary = trackUnreadBoundary(unreadBoundary, shownKey, threadMessages, loadingConversation);
  if (currentBoundary !== unreadBoundary) setUnreadBoundary(currentBoundary);
  const unreadFrom = currentBoundary.messageId;

  const [threadRoot, setThreadRoot] = useState<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadContentRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const loadMoreCalledRef = useRef(false);
  const loadNewerCalledRef = useRef(false);
  const presentRequestedRef = useRef(false);
  const [pagingDirection, setPagingDirection] = useState<PagingDirection>(null);
  const openedKeyRef = useRef<string | null>(null);
  const scrollLockRef = useRef(false);
  const jumpRef = useRef<JumpTarget | null>(null);
  const deepLinkRef = useRef<DeepLink | null>(null);
  const callbacksRef = useRef({ onLoadAround, onClearMessageSearch });

  const [moveToFunnelOpen, setMoveToFunnelOpen] = useState(false);
  const [agentToolDefinitions, setAgentToolDefinitions] = useState<AgentToolDefinition[]>([]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [searchKey, setSearchKey] = useState(liveKey);
  if (searchKey !== liveKey) {
    setSearchKey(liveKey);
    setSearchOpen(false);
    setSearchInput("");
    setCurrentMatchIdx(0);
  }
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const matchedIds = useMemo<ReadonlySet<string>>(
    () => (searchOpen && messageSearchResults ? new Set(messageSearchResults.map((m) => m.id)) : NO_IDS),
    [searchOpen, messageSearchResults],
  );
  const currentMatchId = searchOpen ? (messageSearchResults?.[currentMatchIdx]?.id ?? null) : null;
  const hasSearchResults = Boolean(messageSearchResults && messageSearchResults.length > 0);

  const toolCopy = useThreadToolCopy();
  const toolDefinitions = useMemo<ToolDefinitionByName>(
    () => new Map(agentToolDefinitions.map((tool): [string, AgentToolDefinition] => [tool.name, tool])),
    [agentToolDefinitions],
  );

  const messageActions = useMessageActions(shown);
  const editKey = shown ? windowKey(shown.entry_id, shown.entry_type) : null;
  const editingId = useEditingMessage(editKey);
  const presence = useConversationPresence(shown?.entry_id ?? null, shown?.entry_type ?? null);
  const oldestLoadedAt = shown?.has_more ? (shownMessages[0]?.created_at ?? null) : null;
  const newestLoadedAt = shown?.has_after ? (shownMessages[shownMessages.length - 1]?.created_at ?? null) : null;
  const { notes, deleteNote } = useConversationNotes(shown?.entry_id ?? null, shown?.entry_type ?? null, oldestLoadedAt);
  const shownNotes = useMemo(
    () => visibleNotes(notes, { from: oldestLoadedAt, until: newestLoadedAt }),
    [notes, oldestLoadedAt, newestLoadedAt],
  );

  const automationReplyId = useMemo(() => latestAutomationMessageId(shownMessages), [shownMessages]);
  const {
    calls: toolCalls,
    failure: toolCallsFailure,
    retry: retryToolCalls,
  } = useConversationToolCalls(shown?.entry_id ?? null, shown?.entry_type ?? null, oldestLoadedAt, automationReplyId);
  const shownToolCalls = useMemo(
    () => visibleToolCalls(toolCalls, { from: oldestLoadedAt, until: newestLoadedAt }),
    [toolCalls, oldestLoadedAt, newestLoadedAt],
  );
  const toolCallAgentIds = useMemo(() => toolCalls.map((call) => call.agentId), [toolCalls]);
  const toolCallAgentName = useAgentNamesById(toolCallAgentIds);
  const toolCallNames = useMemo<AgentToolCallNames>(
    () => ({
      agentName: toolCallAgentName,
      toolName: (toolName) => toolDisplayName(toolName, toolDefinitions, toolCopy.fallbackName),
    }),
    [toolCallAgentName, toolDefinitions, toolCopy],
  );

  const rows = useMemo(
    () => buildThreadRows(threadMessages, { unreadFrom, leadNumber: shown?.lead_number, notes: shownNotes, toolCalls: shownToolCalls }),
    [threadMessages, unreadFrom, shown?.lead_number, shownNotes, shownToolCalls],
  );
  const sections = useMemo(() => daySections(rows), [rows]);
  const gallery = useMemo(() => galleryItems(threadMessages), [threadMessages]);
  const messagesById = useMemo(() => new Map(threadMessages.map((m): [string, ConversationMessage] => [m.id, m])), [threadMessages]);

  const arrivedMessages = useMemo(
    () => (arrivals.live.size === 0 ? NO_MESSAGES : threadMessages.filter((m) => arrivals.live.has(m.id))),
    [threadMessages, arrivals.live],
  );
  const describeAnnouncement = useCallback(
    (announcement: Announcement) => {
      if (announcement.count > 1) {
        return announcement.sender
          ? tThread("announce.many", { count: String(announcement.count), sender: announcement.sender })
          : tThread("announce.manyMixed", { count: String(announcement.count) });
      }
      const sender = announcement.sender ?? "";
      if (announcement.preview) return tThread("announce.single", { sender, preview: announcement.preview });
      return tThread("announce.media", { sender, media: tThread(`media.${announcement.mediaKey ?? "document"}`) });
    },
    [tThread],
  );
  const announcement = useLiveAnnouncement(shownKey, arrivedMessages, describeAnnouncement);

  useEffect(() => {
    let active = true;
    getAgentToolsAction()
      .then(({ tools }) => {
        if (active) setAgentToolDefinitions(tools ?? []);
      })
      .catch(() => {
        if (active) setAgentToolDefinitions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    callbacksRef.current = { onLoadAround, onClearMessageSearch };
  }, [onLoadAround, onClearMessageSearch]);

  useEffect(() => {
    callbacksRef.current.onClearMessageSearch?.();
  }, [liveKey]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  const trackThreadAnchor = useThreadAnchor({
    containerRef,
    contentRef: threadContentRef,
    pinnedRef: isAtBottomRef,
    lockedRef: scrollLockRef,
    threadKey: shownKey ?? undefined,
  });

  const scrollToThreadStart = useCallback(() => {
    const divider = containerRef.current?.querySelector("[data-unread-divider]");
    if (!divider) {
      scrollToBottom(false);
      return;
    }
    divider.scrollIntoView({ behavior: "instant", block: "start" });
    trackThreadAnchor();
  }, [scrollToBottom, trackThreadAnchor]);

  const releaseJump = useCallback(() => {
    jumpRef.current = null;
    scrollLockRef.current = false;
  }, []);

  const attemptJump = useCallback(() => {
    const target = jumpRef.current;
    const container = containerRef.current;
    if (!target || !container) return;

    const loadAround = callbacksRef.current.onLoadAround;
    const element = findMessageElement(container, target.id);
    if (element) {
      jumpRef.current = null;
      scrollLockRef.current = true;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      flashElement(element, target.tone, JUMP_FLASH_MS, () => {
        scrollLockRef.current = false;
      });
      return;
    }

    if (!loadAround || target.aroundRequested) {
      releaseJump();
      return;
    }
    target.aroundRequested = true;
    scrollLockRef.current = true;
    setPagingDirection(null);
    loadAround({ messageId: target.id });
  }, [releaseJump]);

  const [jumpRequest, setJumpRequest] = useState<JumpTarget | null>(null);
  const jumpToMessage = useCallback((id: string, tone: FlashTone) => setJumpRequest({ id, tone, aroundRequested: false }), []);
  const searchMatch = searchOpen ? messageSearchResults?.[currentMatchIdx] : undefined;
  const [jumpedMatch, setJumpedMatch] = useState(searchMatch);
  if (searchMatch !== jumpedMatch) {
    setJumpedMatch(searchMatch);
    if (searchMatch) setJumpRequest({ id: searchMatch.id, tone: "warning", aroundRequested: false });
  }

  useEffect(() => {
    if (!jumpRequest) return;
    jumpRef.current = jumpRequest;
    requestAnimationFrame(attemptJump);
  }, [jumpRequest, attemptJump]);

  useEffect(() => {
    if (jumpRef.current && !loadingHistory) requestAnimationFrame(attemptJump);
  }, [threadMessages, loadingHistory, attemptJump]);

  useEffect(() => {
    if (!scrollToMessageTimestamp) return;
    if (deepLinkRef.current?.timestamp !== scrollToMessageTimestamp) {
      deepLinkRef.current = { timestamp: scrollToMessageTimestamp, revealed: false, aroundRequested: false };
      scrollLockRef.current = true;
    }
    const link = deepLinkRef.current;
    if (link.revealed || threadMessages.length === 0 || !containerRef.current) return;

    const target = threadMessages.find((m) => m.created_at === scrollToMessageTimestamp);
    if (target) {
      link.revealed = true;
      requestAnimationFrame(() => {
        const element = containerRef.current ? findMessageElement(containerRef.current, target.id) : null;
        if (element) {
          element.scrollIntoView({ behavior: "instant", block: "center" });
          flashElement(element, "warning", DEEP_LINK_FLASH_MS);
        }
        setTimeout(() => {
          scrollLockRef.current = false;
          onScrolledToMessage?.();
        }, 600);
      });
      return;
    }

    if (onLoadAround) {
      if (link.aroundRequested) return;
      link.aroundRequested = true;
      onLoadAround({ timestamp: scrollToMessageTimestamp });
      return;
    }
    if (shown?.has_more && onLoadMore && !loadingHistory) onLoadMore();
  }, [scrollToMessageTimestamp, threadMessages, onLoadAround, onLoadMore, onScrolledToMessage, shown?.has_more, loadingHistory]);

  useEffect(() => {
    if (loadingHistory) return;
    loadMoreCalledRef.current = false;
    loadNewerCalledRef.current = false;
  }, [loadingHistory]);

  useEffect(() => {
    if (!presentRequestedRef.current || shown?.has_after) return;
    presentRequestedRef.current = false;
    isAtBottomRef.current = true;
    scrollToBottom(false);
  }, [shown?.has_after, threadMessages, scrollToBottom]);

  useEffect(() => {
    if (shownKey === null) {
      openedKeyRef.current = null;
      return;
    }
    if (openedKeyRef.current === shownKey) return;
    isAtBottomRef.current = true;
    if (threadMessages.length === 0) return;
    openedKeyRef.current = shownKey;
    if (scrollLockRef.current) return;
    scrollToThreadStart();
  }, [shownKey, threadMessages.length, scrollToThreadStart]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    trackThreadAnchor();
    const { scrollTop, scrollHeight, clientHeight } = container;
    const away = scrollHeight - scrollTop - clientHeight > 200;
    setShowScrollDown(away);
    if (!away) setUnseen(0);

    if (scrollTop < 60 && shown?.has_more && onLoadMore && !loadingHistory && !loadMoreCalledRef.current) {
      loadMoreCalledRef.current = true;
      setPagingDirection("older");
      onLoadMore();
    }

    const nearBottom = scrollHeight - scrollTop - clientHeight < NEWER_PAGE_DISTANCE_PX;
    if (nearBottom && shown?.has_after && onLoadNewer && !loadingHistory && !loadNewerCalledRef.current) {
      loadNewerCalledRef.current = true;
      setPagingDirection("newer");
      onLoadNewer();
    }
  }, [shown?.has_more, shown?.has_after, onLoadMore, onLoadNewer, loadingHistory, trackThreadAnchor]);

  const jumpToLatest = useCallback(() => {
    if (shown?.has_after && onReturnToPresent) {
      presentRequestedRef.current = true;
      setPagingDirection(null);
      onReturnToPresent();
      return;
    }
    scrollToBottom(true);
  }, [shown?.has_after, onReturnToPresent, scrollToBottom]);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 80);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchInput("");
    setCurrentMatchIdx(0);
    onClearMessageSearch?.();
  }, [onClearMessageSearch]);

  const handleSearchInput = useCallback(
    (value: string) => {
      setSearchInput(value);
      setCurrentMatchIdx(0);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim().length < 2) {
        onClearMessageSearch?.();
        return;
      }
      debounceRef.current = setTimeout(() => {
        onSearchMessages?.(value.trim());
      }, 400);
    },
    [onSearchMessages, onClearMessageSearch],
  );

  const handleNextMatch = useCallback(() => {
    if (!messageSearchResults?.length) return;
    setCurrentMatchIdx((prev) => (prev < messageSearchResults.length - 1 ? prev + 1 : 0));
  }, [messageSearchResults]);

  const handlePrevMatch = useCallback(() => {
    if (!messageSearchResults?.length) return;
    setCurrentMatchIdx((prev) => (prev > 0 ? prev - 1 : messageSearchResults.length - 1));
  }, [messageSearchResults]);

  useShortcuts(
    "thread",
    {
      "thread.search": () => {
        if (!onSearchMessages) return false;
        handleOpenSearch();
      },
    },
    { element: threadRoot },
  );

  const rowContext = useMemo<ThreadRowContextValue | null>(
    () =>
      shown
        ? {
            conversation: shown,
            messagesById,
            matchedIds,
            currentMatchId,
            arrivalStart,
            canSeekOriginal: Boolean(onLoadAround && (shown.has_more || shown.has_after)),
            onJumpToMessage: (id) => jumpToMessage(id, "info"),
            onReply,
            onRetrySend,
            onResendMessage,
            resendingIds,
            toolDefinitions,
            toolCopy,
            messageActions,
            editingId,
            onStartEdit: (messageId) => editKey && startEditing(editKey, messageId),
            onStopEdit: () => editKey && stopEditing(editKey),
            onDeleteNote: (noteId) => void deleteNote(noteId),
          }
        : null,
    [shown, messagesById, matchedIds, currentMatchId, arrivalStart, onLoadAround, jumpToMessage, onReply, onRetrySend, onResendMessage, resendingIds, toolDefinitions, toolCopy, messageActions, editingId, editKey, deleteNote],
  );

  if (!conversation || !shown || !rowContext) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-4 overflow-hidden bg-background px-8 text-center">
        <LightPool />
        <CircuitBoard tone="quiet" className="pointer-events-none absolute bottom-6 right-4 h-64 w-64 xl:h-80 xl:w-80" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[--radius] bg-muted">
          <ImageIcon weight="duotone" className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="relative">
          <h3 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">{t.noConversationSelected}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t.noConversationDescription}</p>
        </div>
      </div>
    );
  }

  const currentStageId = currentEntryTags?.[0]?.stage_id ?? null;
  const stageChoices =
    entryAvailableTags.length > 0
      ? entryAvailableTags.map((stage) => ({ id: stage.stage_id, name: stage.name, color: stage.color }))
      : tags.map((stage) => ({ id: stage.id, name: stage.name, color: stage.color }));
  const canMoveStage = Boolean(onEntryStageChange || onAssignStage);
  const canMoveAcrossFunnels =
    Boolean(onMoveToFunnel) && canMoveStage && funnelStages.filter((f) => f.stages.length > 0).length > 1;

  const moveEntryToStage = (stageId: string) => {
    if (onEntryStageChange) {
      onEntryStageChange(conversation.entry_id, conversation.entry_type, stageId, currentStageId);
      return;
    }
    onAssignStage?.(stageId, conversation.entry_id, conversation.entry_type as EntryType);
  };

  const toggleLabel = (labelId: string, isAssigned: boolean) => {
    if (isAssigned && onRemoveLabel) onRemoveLabel(labelId, conversation.entry_id, conversation.entry_type as EntryType);
    else if (!isAssigned && onAssignLabel) onAssignLabel(labelId, conversation.entry_id, conversation.entry_type as EntryType);
  };

  const showLoader = waiting || (loadingConversation && threadMessages.length === 0);

  return (
    <div ref={setThreadRoot} className="relative flex h-full flex-col">
      <AnimatePresence>
        {searchOpen && (
          <ThreadSearchBar
            inputRef={searchInputRef}
            value={searchInput}
            searching={searchingMessages}
            totalItems={messageSearchTotalItems}
            currentIndex={currentMatchIdx}
            hasResults={hasSearchResults}
            onChange={handleSearchInput}
            onPrevious={handlePrevMatch}
            onNext={handleNextMatch}
            onClose={handleCloseSearch}
          />
        )}
      </AnimatePresence>

      {shown.ad_origin ? (
        <AdOriginBanner origin={shown.ad_origin} entryType={shown.entry_type} entryId={shown.entry_id} />
      ) : null}

      {shown.entry_type === "mercadolivre" ? <MercadoLivreSaleSummary key={shown.entry_id} entryId={shown.entry_id} /> : null}

      {emailSubject ? (
        <p title={emailSubject} className="truncate border-b border-border px-4 py-1.5 text-xs text-muted-foreground">
          {tCrm("emailSubject", { subject: emailSubject })}
        </p>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-start justify-between gap-3">
          <div className="pointer-events-auto flex items-start gap-3">
            {stageChoices.length > 0 && (
              <StageControl
                choices={stageChoices}
                currentStageId={currentStageId}
                hasStages={tags.length > 0}
                canMove={canMoveStage}
                canMoveAcrossFunnels={canMoveAcrossFunnels}
                noPermissionHint={t.noPermissionStageAssign ?? tThread("stage.noPermission")}
                onMove={moveEntryToStage}
                onMoveAcrossFunnels={() => setMoveToFunnelOpen(true)}
              />
            )}
            {availableLabels.length > 0 && (
              <LabelControl
                labels={availableLabels}
                assigned={currentEntryLabels}
                canAssign={Boolean(onAssignLabel)}
                onToggle={toggleLabel}
              />
            )}
          </div>
          {onSearchMessages && !searchOpen && (
            <div className="pointer-events-auto">
              <SearchTrigger label={tCrm("searchMessages")} onOpen={handleOpenSearch} />
            </div>
          )}
        </div>

        <ConversationAnalysisPanel
          entryId={conversation.entry_id}
          entryType={conversation.entry_type as "whatsapp"}
          liveRead={liveRead}
        />

        <div
          ref={containerRef}
          onScroll={handleScroll}
          role="region"
          aria-label={tThread("messagesRegion")}
          aria-busy={waiting}
          inert={waiting}
          tabIndex={0}
          className="relative flex-1 overflow-y-auto px-4 py-4 focus-visible:outline-none"
        >
          <ThreadRowProvider value={rowContext}>
            <AgentToolCallNamesProvider value={toolCallNames}>
              <MediaGalleryProvider items={gallery}>
                <div ref={threadContentRef} className="mx-auto max-w-3xl space-y-1">
                  <EntryMetadataPanel conversation={shown} />

                  {loadingHistory && pagingDirection !== "newer" && (
                    <div className="flex items-center justify-center py-3">
                      <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2 shadow-sm">
                        <ScreenLoader fit="inline" label={t.loadingMore} />
                      </div>
                    </div>
                  )}

                  {sections.map((section) => (
                    <section key={section.day.key}>
                      <ThreadRowView row={section.day} />
                      {section.rows.map((row) => (
                        <Fragment key={row.key}>
                          {"runGap" in row && row.runGap ? <div aria-hidden="true" className="h-1" /> : null}
                          <ThreadRowView row={row} />
                        </Fragment>
                      ))}
                    </section>
                  ))}

                  {toolCallsFailure && <AgentToolCallsLoadError failure={toolCallsFailure} onRetry={retryToolCalls} />}

                  <AnimatePresence>
                    {isTyping && !waiting && (
                      <motion.div
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={stateTransition}
                        className="flex justify-start"
                      >
                        <div className="rounded-lg bg-card shadow-sm">
                          <TypingIndicator names={presence.typingNames} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {loadingHistory && pagingDirection === "newer" && (
                    <div className="flex items-center justify-center py-3">
                      <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2 shadow-sm">
                        <ScreenLoader fit="inline" label={tThread("loadingNewer")} />
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              </MediaGalleryProvider>
            </AgentToolCallNamesProvider>
          </ThreadRowProvider>
        </div>

        {showLoader && <ScreenLoader fit="fill" className={cn("absolute inset-0 z-20", waiting && "bg-background")} />}

        <AnimatePresence>
          {(showScrollDown || Boolean(shown.has_after)) && !waiting && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={stateTransition}
              onClick={jumpToLatest}
              aria-label={unseen > 0 ? tThread("newMessagesBelow", { count: unseen }) : tThread("scrollToLatest")}
              className="absolute bottom-4 right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-lg border border-border hover:bg-muted transition-colors"
            >
              <ArrowDown weight="bold" className="h-4 w-4 text-muted-foreground" />
              {unseen > 0 ? (
                <span
                  aria-hidden="true"
                  data-unseen-count={unseen}
                  className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-healthy px-1 text-2xs font-semibold tabular-nums text-healthy-foreground"
                >
                  {unseen > 99 ? "99+" : unseen}
                </span>
              ) : null}
            </motion.button>
          )}
        </AnimatePresence>

        <div aria-live="polite" aria-atomic="true" className="sr-only" data-thread-announcer="">
          {announcement}
        </div>
      </div>

      {canMoveAcrossFunnels && onMoveToFunnel ? (
        <MoveToFunnelDialog
          open={moveToFunnelOpen}
          onOpenChange={setMoveToFunnelOpen}
          funnels={funnelStages}
          currentStageId={currentStageId}
          currentStageName={currentEntryTags?.[0]?.name ?? null}
          contactName={conversation.lead_name || conversation.lead_number}
          onConfirm={(stageId) => onMoveToFunnel(conversation.entry_id, conversation.entry_type as EntryType, stageId)}
        />
      ) : null}
    </div>
  );
}

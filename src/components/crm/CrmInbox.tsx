"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChannelAvatar } from "@/components/channels/channel-avatar";
import { ChannelLogo } from "@/components/icons/channel-logos";
import {
  FILTERABLE_MESSAGE_CHANNELS,
  type MessageChannel,
} from "@/lib/conversations/types";
import {
  ArrowSquareOut,
  CalendarBlank,
  CaretDown,
  ChatCircleDots,
  CheckSquare,
  Clock,
  CircleNotch,
  Funnel,
  MagnifyingGlass,
  PushPin,
  Tag as TagIcon,
  UsersThree,
  X,
} from "@/components/icons";
import type {
  CampaignType,
  ConnectionStatus,
  EntryType,
  InboxEntry,
  InboxSort,
  Label,
  MatchedMessage,
  Stage,
  WsSearchInboxPayload,
} from "@/lib/conversations/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InboxBulkBar } from "@/components/crm/InboxBulkBar";
import { ConversationViewers } from "@/components/crm/ConversationViewers";
import { SelectionCheckbox } from "@/components/selection/SelectionCheckbox";
import { useInboxSelection } from "@/hooks/use-inbox-selection";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { useInboxSort } from "@/hooks/use-inbox-sort";
import { useInboxTimeText } from "@/hooks/use-inbox-time-text";
import { usePersonalActions } from "@/hooks/use-personal-actions";
import type { PersonalInboxControls } from "@/hooks/use-personal-marks";
import { NO_PERSONAL_MARKS } from "@/lib/conversations/personal-marks";
import { inboxSections, sectionEntries } from "@/lib/conversations/inbox-sections";
import { inboxCanHaveGroups, needsServerList } from "@/lib/conversations/inbox-query";
import { INBOX_SORTS } from "@/lib/conversations/inbox-sort";
import { waitingAlert } from "@/lib/conversations/waiting";
import type { FunnelStages } from "@/app/actions/stages";
import {
  conversationStatusText,
  getConversationStatusDisplay,
  type StatusTranslator,
} from "@/lib/conversations/close-provenance";
import { AiHandlerChip } from "@/components/crm/AiHandlerChip";
import { AssigneeGlyph } from "@/components/crm/AssigneeGlyph";
import { InboxEntryContextMenu, InboxEntryMenuButton, type InboxEntryMenuActions } from "@/components/crm/InboxEntryContextMenu";
import { useRouter } from "@/i18n/routing";
import { leadDetailHref } from "@/lib/leads/detail";
import { ownerLineNamesTheAutomation } from "@/lib/conversations/attendance-summary";
import {
  RESPONSIBLE_AI,
  RESPONSIBLE_UNASSIGNED,
  RESPONSIBLE_WORKFLOW,
  responsibleFilterPayload,
} from "@/lib/conversations/responsible-filter";
import { previewWithAuthor } from "@/lib/conversations/group-preview";
import { senderLabelKey } from "@/lib/conversations/sender-label";
import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";

import AnalysisHoverCard from "@/components/crm/AnalysisHoverCard";
import { effectiveAnalysis } from "@/lib/analysis/live";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { cn, readableInkFor } from "@/lib/utils";
import { motion as framerMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";
import { useBlockedByMissingDepartment } from "@/components/dashboard/NoDepartmentNotice";
import {
  listAssignableMembersAction,
  type AssignableMember,
} from "@/app/actions/workspace";
import { HighlightedText } from "@/components/crm/highlighted-text";
import { InboxEmptyState } from "@/components/crm/InboxEmptyState";
import { InboxUpdatesPill } from "@/components/crm/InboxUpdatesPill";
import { InboxRowPreview } from "@/components/crm/InboxRowPreview";
import { useOptionalCrm } from "@/contexts/crm-context";
import { typistsIn } from "@/lib/conversations/typing";
import type { ConversationOpenSource } from "@/lib/conversations/open-source";
import { useCompactAgeText } from "@/hooks/use-compact-age";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useHoverIntent } from "@/hooks/use-hover-intent";
import { holdPlacement, inboxEntryKey } from "@/lib/conversations/inbox-hold";
import { inboxEmptyState } from "@/lib/conversations/inbox-empty";
import { moveListFocus, rovingStop, type FocusStep } from "@/lib/conversations/list-focus";
import { SHORTCUT_SCOPE_ATTRIBUTE } from "@/lib/keyboard/crm-bindings";


function truncate(text: string | undefined | null, max: number) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

function formatMatchTime(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function getConversationStatusMeta(
  t: StatusTranslator,
  status?: string | null,
  closeSource?: string | null,
  closeReason?: string | null,
) {
  const d = getConversationStatusDisplay(status, closeSource, closeReason);
  return {
    label: conversationStatusText(d, t).label,
    className: d.dotClassName,
    isSilence: d.provenance?.isSilence === true,
  };
}


interface CrmInboxProps {
  entries: InboxEntry[];
  selectedEntryId: string | null;
  onSelect: (entryId: string, entryType: EntryType, source?: ConversationOpenSource) => void;
  onPrefetchConversation?: (entryId: string, entryType: EntryType) => void;
  onOpenInWindow?: (entry: InboxEntry) => void;
  openInWindowLabel?: string;
  connectionStatus: ConnectionStatus;
  onLoadMore?: () => void;
  hasMore?: boolean;
  inboxTotalItems?: number;
  totalContacts?: number | null;
  conversationStatusCounts?: Record<string, number>;
  loadingMore?: boolean;
  tags?: Stage[];
  funnelStages?: FunnelStages[];
  campaignType?: CampaignType;
  translations: {
    title: string;
    searchPlaceholder: string;
    noConversations: string;
    connecting: string;
    disconnected: string;
    connected: string;
    loadingMore: string;
  };
  onSearch?: (filters: WsSearchInboxPayload) => void;
  onClearSearch?: () => void;
  onConversationStatusFilterChange?: (
    status: "" | "new" | "ongoing" | "finished",
  ) => void;
  searchResults?: InboxEntry[] | null;
  searching?: boolean;
  searchTotalItems?: number;
  searchTotalPages?: number;
  searchPage?: number;
  searchHasMore?: boolean;
  onLoadMoreSearch?: (page: number) => void;
  loadingSearchMore?: boolean;
  onNavigateToMessage?: (
    entryId: string,
    entryType: EntryType,
    createdAt: string,
  ) => void;
  onEntryStageChange?: (
    entryId: string,
    entryType: EntryType,
    newTagId: string,
    oldTagId: string | null,
  ) => void;
  noPermissionStageAssign?: string;
  labels?: Label[];
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
  onAssignTo?: (entryId: string, entryType: EntryType, userId: string) => void;
  onlineUserIds?: ReadonlySet<string>;
  controlRef?: Ref<InboxControl>;
  onReplyToOpen?: () => void;
  personalInbox?: PersonalInboxControls;
}

export interface InboxControl {
  focusSearch: () => void;
  resumeSearch: () => void;
}

const ROW_ATTRIBUTE = "data-inbox-row";



interface FilterState {
  stageId: string;
  stageName: string;
  channel: "" | MessageChannel;
  dateFrom: string;
  dateTo: string;
  windowOpen: "" | "true" | "false";
  hasUnread: "" | "true" | "false";
  minMessageCount: string;
  maxMessageCount: string;
  messageSearch: string;
  responsibleUserId: string;
  labelId: string;
}

const CHANNEL_FILTER_LABELS: Record<MessageChannel, string> = {
  whatsapp: "WhatsApp",
  unofficial_whatsapp: "WhatsApp (não oficial)",
  instagram: "Instagram",
  facebook: "Messenger",
  telegram: "Telegram",
  webchat: "WebChat",
  mercadolivre: "Mercado Livre",
  tiktok: "TikTok",
};

const EMPTY_FILTERS: FilterState = {
  stageId: "",
  stageName: "",
  channel: "",
  dateFrom: "",
  dateTo: "",
  windowOpen: "",
  hasUnread: "",
  minMessageCount: "",
  maxMessageCount: "",
  messageSearch: "",
  responsibleUserId: "",
  labelId: "",
};

type ConversationStatusFilter = "all" | "new" | "ongoing" | "finished";

const STATUS_TABS = ["all", "new", "ongoing", "finished"] as const satisfies readonly ConversationStatusFilter[];

function countActiveFilters(f: FilterState): number {
  let count = 0;
  if (f.stageId || f.stageName) count++;
  if (f.channel) count++;
  if (f.dateFrom || f.dateTo) count++;
  if (f.windowOpen) count++;
  if (f.hasUnread) count++;
  if (f.minMessageCount || f.maxMessageCount) count++;
  if (f.messageSearch) count++;
  if (f.responsibleUserId) count++;
  if (f.labelId) count++;
  return count;
}

export default function CrmInbox({
  entries,
  selectedEntryId,
  onSelect,
  onPrefetchConversation,
  onOpenInWindow,
  openInWindowLabel,
  connectionStatus,
  onLoadMore,
  hasMore = false,
  inboxTotalItems,
  totalContacts,
  conversationStatusCounts,
  loadingMore = false,
  tags: availableTags = [],
  funnelStages = [],
  campaignType,
  translations: t,
  onSearch,
  onClearSearch,
  onConversationStatusFilterChange,
  searchResults,
  searching = false,
  searchTotalItems = 0,
  searchTotalPages = 0,
  searchPage = 1,
  searchHasMore = false,
  onLoadMoreSearch,
  loadingSearchMore = false,
  onNavigateToMessage,
  onEntryStageChange,
  noPermissionStageAssign,
  labels: availableLabels = [],
  onAssignLabel,
  onRemoveLabel,
  onAssignTo,
  onlineUserIds,
  controlRef,
  onReplyToOpen,
  personalInbox,
}: CrmInboxProps) {
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [listElement, setListElement] = useState<HTMLDivElement | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [heldKeys, setHeldKeys] = useState<string[] | null>(null);
  const ageText = useCompactAgeText();
  const now = useMinuteClock();
  const [sort, setSort] = useInboxSort();
  const personal = usePersonalActions(personalInbox);
  const marks = personalInbox?.marks ?? NO_PERSONAL_MARKS;
  const timeText = useInboxTimeText();
  const tList = useTranslations("crmInbox");
  const labelFilterId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [stateFilter, setStateFilter] =
    useState<ConversationStatusFilter>("all");
  const [groupsOnly, setGroupsOnly] = useState(false);
  const showGroupsFilter = inboxCanHaveGroups(campaignType);
  const [tagMenuEntryId, setTagMenuEntryId] = useState<string | null>(null);
  const [expandedLabelsEntryId, setExpandedLabelsEntryId] = useState<
    string | null
  >(null);
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);
  const prefetchIntent = useHoverIntent((entry: InboxEntry) => onPrefetchConversation?.(entry.entry_id, entry.entry_type));
  const [hoveredRect, setHoveredRect] = useState<{
    top: number;
    right: number;
    height: number;
  } | null>(null);
  const hoveredAnalysisRef = useRef<
    import("@/lib/analysis/types").Analysis | null
  >(null);
  const { can, currentWorkspace } = useWorkspace();
  const typingByEntry = useOptionalCrm()?.typingByEntry;
  const blockedByDepartment = useBlockedByMissingDepartment();
  const tAnalysis = useTranslations("crmAnalysis");
  const tInbox = useTranslations("liveChat.inbox");
  const tStatus = useTranslations("conversationStatus");
  const tCrm = useTranslations("crm");
  const previewSender = (entry: InboxEntry) => {
    const key = senderLabelKey(entry.last_message_sender_kind, entry.entry_type);
    return key ? tCrm(key) : null;
  };
  const router = useRouter();

  const [members, setMembers] = useState<AssignableMember[]>([]);
  useEffect(() => {
    const wsId = currentWorkspace?.id;
    if (!wsId) return;
    let cancelled = false;
    void listAssignableMembersAction(wsId, { pageSize: 200 }).then((res) => {
      if (!cancelled && !res.error) setMembers(res.members);
    });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id]);
  const canReadAnalysis = can("audience", "read");
  const opensLeads = can("leads", "read");
  const togglesLabels = can("labels", "assign") && availableLabels.length > 0 && Boolean(onAssignLabel && onRemoveLabel);
  const menuActions = (entry: InboxEntry): InboxEntryMenuActions => ({
    onOpen: () => onSelect(entry.entry_id, entry.entry_type),
    onOpenInWindow: onOpenInWindow ? () => onOpenInWindow(entry) : undefined,
    onSelectRow: () => selection.start(inboxEntryKey(entry)),
    onOpenLead: opensLeads && entry.lead_id ? () => router.push(leadDetailHref(entry.lead_id ?? "")) : undefined,
    members,
    onlineUserIds,
    onAssignTo: onAssignTo ? (userId) => onAssignTo(entry.entry_id, entry.entry_type, userId) : undefined,
    onMoveStage: onEntryStageChange
      ? (stageId) => onEntryStageChange(entry.entry_id, entry.entry_type, stageId, entry.stage?.stage_id ?? null)
      : undefined,
    labels: availableLabels,
    onToggleLabel: togglesLabels
      ? (labelId, assigned) => (assigned ? onRemoveLabel : onAssignLabel)?.(labelId, entry.entry_id, entry.entry_type)
      : undefined,
    personal: personal.available
      ? {
          pinned: personal.isPinned(entry),
          canMarkUnread: personal.canMarkUnread(entry),
          onTogglePin: () => personal.togglePin(entry),
          onMarkUnread: () => personal.markUnread(entry),
        }
      : undefined,
  });
  const inboxListRef = useRef<HTMLDivElement | null>(null);
  const attachList = useCallback((node: HTMLDivElement | null) => {
    inboxListRef.current = node;
    setListElement(node);
  }, []);
  const loadMoreCalledRef = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stateCounts = useMemo(() => {
    const statusScopedTotal =
      (conversationStatusCounts?.["new"] ?? 0) +
      (conversationStatusCounts?.["ongoing"] ?? 0);

    const counts = {
      all:
        statusScopedTotal > 0
          ? statusScopedTotal
          : inboxTotalItems != null && inboxTotalItems > 0
            ? inboxTotalItems
            : entries.length,
      new: conversationStatusCounts?.["new"] ?? 0,
      ongoing: conversationStatusCounts?.["ongoing"] ?? 0,
      finished: conversationStatusCounts?.["finished"] ?? 0,
    };
    return counts;
  }, [entries, inboxTotalItems, conversationStatusCounts]);

  const allMatchedMessages = useMemo(() => {
    if (!searchResults) return [];
    const results: {
      match: MatchedMessage;
      entryId: string;
      entryType: EntryType;
      leadName: string;
    }[] = [];
    for (const entry of searchResults) {
      if (entry.matched_messages?.length) {
        for (const match of entry.matched_messages) {
          results.push({
            match,
            entryId: entry.entry_id,
            entryType: entry.entry_type,
            leadName: entry.lead_name || entry.lead_number,
          });
        }
      }
    }
    return results;
  }, [searchResults]);


  const buildPayload = useCallback(
    (
      overrides?: Partial<{
        query: string;
        page: number;
        conversationStatus: ConversationStatusFilter;
        filters: FilterState;
        sort: InboxSort;
        groupsOnly: boolean;
      }>,
    ): WsSearchInboxPayload => {
      const payload: WsSearchInboxPayload = {
        page: overrides?.page ?? 1,
        page_size: 20,
      };
      const effectiveStatus = overrides?.conversationStatus ?? stateFilter;
      const chosen = overrides?.filters ?? filters;
      const effectiveSort = overrides?.sort ?? sort;
      const q = overrides?.query ?? search.trim();
      if (q.length >= 2) payload.query = q;
      if (chosen.labelId) payload.label_id = chosen.labelId;
      if (effectiveSort !== "recent") payload.sort = effectiveSort;
      if (chosen.stageId) payload.stage_id = chosen.stageId;
      else if (chosen.stageName) payload.stage_name = chosen.stageName;
      if (chosen.channel)
        payload.channel = chosen.channel;
      if (chosen.dateFrom)
        payload.date_from = new Date(chosen.dateFrom).toISOString();
      if (chosen.dateTo) {
        const d = new Date(chosen.dateTo);
        d.setHours(23, 59, 59, 999);
        payload.date_to = d.toISOString();
      }
      if (chosen.windowOpen === "true") payload.window_open = true;
      else if (chosen.windowOpen === "false") payload.window_open = false;
      if (chosen.hasUnread === "true") payload.has_unread = true;
      else if (chosen.hasUnread === "false") payload.has_unread = false;
      if (overrides?.groupsOnly ?? groupsOnly) payload.is_group = true;
      if (chosen.minMessageCount)
        payload.min_message_count = Number(chosen.minMessageCount);
      if (chosen.maxMessageCount)
        payload.max_message_count = Number(chosen.maxMessageCount);
      if (chosen.messageSearch.trim())
        payload.message_search = chosen.messageSearch.trim();
      Object.assign(payload, responsibleFilterPayload(chosen.responsibleUserId));
      if (effectiveStatus !== "all") payload.conversation_status = effectiveStatus;
      return payload;
    },
    [search, filters, stateFilter, sort, groupsOnly],
  );

  const hasAnyFilter =
    search.trim().length >= 2 ||
    countActiveFilters(filters) > 0 ||
    stateFilter !== "all" ||
    groupsOnly;

  const submit = useCallback(
    (payload: WsSearchInboxPayload) => {
      if (!onSearch) return;
      if (needsServerList(payload)) onSearch(payload);
      else onClearSearch?.();
    },
    [onSearch, onClearSearch],
  );

  const fireSearch = useCallback(
    (overrides?: Partial<{ query: string; page: number }>) => submit(buildPayload(overrides)),
    [submit, buildPayload],
  );

  useEffect(() => {
    if (!onSearch || !onClearSearch) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (search.trim().length >= 2 || countActiveFilters(filters) > 0) {
      searchTimeoutRef.current = setTimeout(() => {
        fireSearch();
      }, 350);
    } else if (
      search.trim().length === 0 &&
      countActiveFilters(filters) === 0
    ) {
      fireSearch();
    }

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleApplyFilters = useCallback(() => {
    fireSearch();
  }, [fireSearch]);

  useImperativeHandle(
    controlRef,
    () => ({
      focusSearch: () => searchInputRef.current?.focus(),
      resumeSearch: () => fireSearch(),
    }),
    [fireSearch],
  );

  const handleClearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    submit(buildPayload({ filters: EMPTY_FILTERS }));
  }, [submit, buildPayload]);

  const handleClearAll = useCallback(() => {
    setSearch("");
    setFilters(EMPTY_FILTERS);
    setStateFilter("all");
    setGroupsOnly(false);
    setFiltersOpen(false);
    onConversationStatusFilterChange?.("");
    submit(buildPayload({ query: "", filters: EMPTY_FILTERS, conversationStatus: "all", groupsOnly: false }));
  }, [submit, buildPayload, onConversationStatusFilterChange]);

  const chooseSort = useCallback(
    (next: InboxSort) => {
      setSort(next);
      submit(buildPayload({ sort: next }));
    },
    [setSort, submit, buildPayload],
  );

  const isServerSearchActive =
    searchResults !== null && searchResults !== undefined;
  const wantsServerList = sort === "waiting";
  useEffect(() => {
    if (connectionStatus !== "connected" || !wantsServerList || isServerSearchActive || searching) return;
    fireSearch();
  }, [connectionStatus, wantsServerList, isServerSearchActive, searching, fireSearch]);
  const displayEntries = useMemo(() => {
    if (isServerSearchActive) {
      return searchResults!;
    }

    let result = entries;

    if (!onSearch) {
      result = result.filter((e) =>
        stateFilter === "all"
          ? e.conversation_status !== "finished"
          : e.conversation_status === stateFilter,
      );
    }

    if (search.trim() && search.trim().length < 2) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          (e.lead_name || e.lead_number || "").toLowerCase().includes(q) ||
          (e.lead_number || "").toLowerCase().includes(q) ||
          (e.last_message_preview || "").toLowerCase().includes(q),
      );
    }

    return result;
  }, [
    entries,
    search,
    isServerSearchActive,
    searchResults,
    stateFilter,
    onSearch,
  ]);

  const datasetKey = `${isServerSearchActive}|${stateFilter}|${search.trim()}`;
  const [heldDataset, setHeldDataset] = useState(datasetKey);
  if (heldDataset !== datasetKey) {
    setHeldDataset(datasetKey);
    setHeldKeys(null);
  }
  const listed = useMemo(
    () => (heldKeys ? holdPlacement(heldKeys, displayEntries) : { entries: displayEntries, pending: 0 }),
    [heldKeys, displayEntries],
  );
  const sections = useMemo(() => inboxSections(listed.entries, marks), [listed.entries, marks]);
  const orderedEntries = useMemo(() => sectionEntries(sections), [sections]);
  const listedKeys = useMemo(() => orderedEntries.map(inboxEntryKey), [orderedEntries]);
  const selection = useInboxSelection(`classic-inbox|${datasetKey}`, listedKeys);
  const { active: selecting, pickOrStart, leave: leaveSelection } = selection;
  const selectControlRef = useRef<HTMLButtonElement>(null);
  const leaveSelectionFromToolbar = () => {
    leaveSelection();
    selectControlRef.current?.focus();
  };
  const pickedTargets = orderedEntries
    .filter((entry) => selection.picked.has(inboxEntryKey(entry)))
    .map((entry) => ({ entryId: entry.entry_id, entryType: entry.entry_type }));
  const selectedEntry = useMemo(
    () => displayEntries.find((entry) => entry.entry_id === selectedEntryId) ?? null,
    [displayEntries, selectedEntryId],
  );
  const tabStop = rovingStop(listedKeys, focusedKey, selectedEntry ? inboxEntryKey(selectedEntry) : null);

  const holdOrder = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType === "mouse") setHeldKeys(displayEntries.map(inboxEntryKey));
    },
    [displayEntries],
  );
  const releaseOrder = useCallback(() => setHeldKeys(null), []);
  const applyHeldUpdates = useCallback(() => setHeldKeys(displayEntries.map(inboxEntryKey)), [displayEntries]);

  const rowElement = useCallback(
    (key: string) => listElement?.querySelector<HTMLElement>(`[${ROW_ATTRIBUTE}="${CSS.escape(key)}"]`) ?? null,
    [listElement],
  );
  const moveFocus = useCallback(
    (step: FocusStep) => {
      const next = moveListFocus(listedKeys, tabStop, step);
      if (!next) return;
      setFocusedKey(next);
      const row = rowElement(next);
      row?.focus();
      row?.scrollIntoView?.({ block: "nearest" });
    },
    [listedKeys, rowElement, tabStop],
  );
  const focusedEntry = useCallback(
    (event: KeyboardEvent): InboxEntry | null => {
      const row = (event.target as HTMLElement | null)?.closest?.(`[${ROW_ATTRIBUTE}]`);
      if (!row || row !== event.target) return null;
      return listed.entries.find((candidate) => inboxEntryKey(candidate) === row.getAttribute(ROW_ATTRIBUTE)) ?? null;
    },
    [listed.entries],
  );
  const onFocusedEntry = useCallback(
    (act: (entry: InboxEntry) => void, enabled = true) =>
      (event: KeyboardEvent) => {
        const entry = enabled ? focusedEntry(event) : null;
        if (!entry) return false;
        act(entry);
      },
    [focusedEntry],
  );
  const { available: personalAvailable, togglePin, markUnread } = personal;
  useShortcuts(
    "inbox",
    {
      "inbox.next": () => moveFocus(1),
      "inbox.previous": () => moveFocus(-1),
      "inbox.open": onFocusedEntry((entry) => onSelect(entry.entry_id, entry.entry_type, "keyboard")),
      "inbox.reply": () => (onReplyToOpen ? onReplyToOpen() : false),
      "inbox.pin": onFocusedEntry(togglePin, personalAvailable),
      "inbox.markUnread": onFocusedEntry(markUnread, personalAvailable),
      "inbox.select": onFocusedEntry((entry) => pickOrStart(inboxEntryKey(entry))),
      "inbox.clearSelection": () => (selecting ? leaveSelection() : false),
    },
    { element: listElement },
  );

  const currentHoveredAnalysis = useMemo(() => {
    if (!hoveredEntryId) return null;
    const entry = displayEntries.find(
      (e) => `${e.entry_type}-${e.entry_id}` === hoveredEntryId,
    );
    return entry ? effectiveAnalysis(entry) : null;
  }, [hoveredEntryId, displayEntries]);

  if (currentHoveredAnalysis) {
    hoveredAnalysisRef.current = currentHoveredAnalysis;
  }

  const statusDot =
    connectionStatus === "connected"
      ? "bg-healthy"
      : connectionStatus === "connecting"
        ? "bg-warning animate-pulse"
        : "bg-muted-foreground/40";

  const statusLabel =
    connectionStatus === "connected"
      ? t.connected
      : connectionStatus === "connecting"
        ? t.connecting
        : t.disconnected;

  const handleInboxScroll = useCallback(() => {
    const el = inboxListRef.current;
    if (!el) return;

    if (hoveredEntryId) setHoveredEntryId(null);

    const { scrollTop, scrollHeight, clientHeight } = el;
    const fromBottom = scrollHeight - scrollTop - clientHeight;

    if (
      isServerSearchActive &&
      searchHasMore &&
      !loadingSearchMore &&
      onLoadMoreSearch
    ) {
      if (fromBottom < 100 && !loadMoreCalledRef.current) {
        loadMoreCalledRef.current = true;
        onLoadMoreSearch(searchPage + 1);
      }
      return;
    }

    if (!hasMore || loadingMore || loadMoreCalledRef.current) return;
    if (fromBottom < 100) {
      loadMoreCalledRef.current = true;
      onLoadMore?.();
    }
  }, [
    hasMore,
    loadingMore,
    onLoadMore,
    isServerSearchActive,
    searchHasMore,
    loadingSearchMore,
    onLoadMoreSearch,
    searchPage,
    hoveredEntryId,
  ]);

  const toggleGroupsOnly = useCallback(() => {
    const next = !groupsOnly;
    setGroupsOnly(next);
    submit(buildPayload({ groupsOnly: next }));
  }, [groupsOnly, submit, buildPayload]);

  const handleStateFilterChange = useCallback(
    (newFilter: ConversationStatusFilter) => {
      setStateFilter(newFilter);
      onConversationStatusFilterChange?.(newFilter === "all" ? "" : newFilter);
      submit(buildPayload({ conversationStatus: newFilter }));
    },
    [submit, onConversationStatusFilterChange, buildPayload],
  );

  useEffect(() => {
    if (!loadingMore && !loadingSearchMore) loadMoreCalledRef.current = false;
  }, [loadingMore, loadingSearchMore]);

  const activeFilterCount = countActiveFilters(filters);

  const filterStageGroups = useMemo(() => {
    const grouped = funnelStages.filter((g) => g.stages.length > 0);
    if (grouped.length > 0) return grouped;
    if (availableTags.length === 0) return [];
    return [
      {
        pipelineId: "",
        pipelineName: "",
        isDefault: false,
        position: 0,
        stages: availableTags,
      },
    ];
  }, [funnelStages, availableTags]);

  const filterStageOptions = useMemo(
    () => filterStageGroups.flatMap((g) => g.stages),
    [filterStageGroups],
  );

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex-shrink-0 border-b border-border">
        <div className="flex h-7 items-center gap-2 bg-muted px-3">
          <ChatCircleDots
            weight="regular"
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="legend shrink-0">{t.title}</span>
          {onSearch ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`${tList("sort.label")}: ${tList(`sort.${sort}`)}`}
                className="inline-flex min-w-0 items-center gap-1 rounded-[--radius] px-1.5 py-0.5 text-2xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate">{tList(`sort.${sort}`)}</span>
                <CaretDown className="h-3 w-3 shrink-0" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuRadioGroup value={sort} onValueChange={(value) => chooseSort(value as InboxSort)}>
                  {INBOX_SORTS.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option} className="text-xs">
                      {tList(`sort.${option}`)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <span className="ml-auto flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot)}
            />
            <span className="legend">{statusLabel}</span>
            {entries.length > 0 && !isServerSearchActive && (
              <span className="readout ml-1 text-2xs font-semibold text-foreground">
                {totalContacts != null
                  ? totalContacts
                  : inboxTotalItems != null && inboxTotalItems > 0
                    ? inboxTotalItems
                    : entries.length}
              </span>
            )}
          </span>
        </div>

        <div className="px-3 py-2">

        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <MagnifyingGlass
              weight="bold"
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full rounded-[--radius] border border-border bg-muted py-2 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-border focus:bg-card focus:ring-2 focus:ring-healthy/30"
            />
            {search.trim() && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
              >
                <X weight="bold" className="h-3 w-3" />
              </button>
            )}
            {searching && !search.trim() && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <motion.div
                  className="h-3 w-3 rounded-full border border-healthy border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              </div>
            )}
          </div>

          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "relative flex h-[34px] w-[34px] items-center justify-center rounded-[--radius] border transition-colors flex-shrink-0",
              filtersOpen || activeFilterCount > 0
                ? "border-healthy/30 bg-healthy text-healthy-foreground"
                : "border-border bg-muted text-muted-foreground hover:text-muted-foreground hover:border-foreground/20",
            )}
            title="Filtros avançados"
          >
            <Funnel
              weight={filtersOpen || activeFilterCount > 0 ? "fill" : "regular"}
              className="h-3.5 w-3.5"
            />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-[--radius] bg-healthy px-0.5 text-2xs font-semibold text-healthy-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>

          <TooltipWrapper content={tList("select.startHint")} enabled side="bottom">
            <button
              ref={selectControlRef}
              type="button"
              aria-label={tList("select.start")}
              aria-pressed={selecting}
              onClick={() => (selecting ? leaveSelection() : selection.start())}
              className={cn(
                "flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[--radius] border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selecting
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground hover:border-foreground/20 hover:text-foreground",
              )}
            >
              <CheckSquare className="h-3.5 w-3.5" />
            </button>
          </TooltipWrapper>
        </div>

        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-0.5 -mb-0.5">
          {STATUS_TABS.map((key) => (
            <button
              key={key}
              onClick={() => handleStateFilterChange(key)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-medium whitespace-nowrap transition-all duration-150",
                stateFilter === key
                  ? "bg-healthy text-healthy-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-border",
              )}
            >
              {tList(`tabs.${key}`)}
              <span
                className={cn(
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-2xs font-semibold",
                  stateFilter === key
                    ? "bg-black/20 text-healthy-foreground"
                    : "bg-border text-muted-foreground",
                )}
              >
                {stateCounts[key]}
              </span>
            </button>
          ))}
          {showGroupsFilter ? (
            <>
              <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
              <button
                type="button"
                aria-pressed={groupsOnly}
                onClick={toggleGroupsOnly}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-medium whitespace-nowrap transition-all duration-150",
                  groupsOnly
                    ? "bg-healthy text-healthy-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-border",
                )}
              >
                <UsersThree className="h-3.5 w-3.5" weight={groupsOnly ? "fill" : "regular"} />
                {tList("filters.groups")}
              </button>
            </>
          ) : null}
        </div>

        {(isServerSearchActive || searching) && (
          <div className="mt-2 flex items-center gap-2">
            {searching && (
              <motion.div
                className="h-3 w-3 rounded-full border border-healthy border-t-transparent flex-shrink-0"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
            )}
            {isServerSearchActive && !searching && (
              <span className="text-2xs font-medium text-muted-foreground">
                {searchTotalItems} resultado{searchTotalItems !== 1 ? "s" : ""}
              </span>
            )}
            {hasAnyFilter && (
              <button
                onClick={handleClearAll}
                className="ml-auto text-2xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Limpar busca
              </button>
            )}
          </div>
        )}
        </div>
      </div>

      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-b border-border bg-muted flex-shrink-0"
          >
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-2xs font-semibold text-muted-foreground mb-1 block">
                    Etapa
                  </label>
                  <select
                    value={filters.stageId}
                    onChange={(e) => {
                      const stage = filterStageOptions.find(
                        (s) => s.id === e.target.value,
                      );
                      setFilters((f) => ({
                        ...f,
                        stageId: e.target.value,
                        stageName: stage?.name ?? "",
                      }));
                    }}
                    className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-2xs text-foreground outline-none focus:border-healthy/30 focus:ring-1 focus:ring-healthy/30"
                  >
                    <option value="">Todas</option>
                    {filterStageGroups.map((group) => (
                      <optgroup
                        key={group.pipelineId || "__sem_funil__"}
                        label={group.pipelineName || "Sem funil"}
                      >
                        {group.stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-0">
                  <label className="text-2xs font-semibold text-muted-foreground mb-1 block">
                    Canal
                  </label>
                  <select
                    value={filters.channel}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        channel: e.target.value as FilterState["channel"],
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-2xs text-foreground outline-none focus:border-healthy/30 focus:ring-1 focus:ring-healthy/30"
                  >
                    <option value="">Todos</option>
                    {FILTERABLE_MESSAGE_CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {CHANNEL_FILTER_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-2xs font-semibold text-muted-foreground mb-1 block">
                    Responsável
                  </label>
                  <select
                    value={filters.responsibleUserId}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        responsibleUserId: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-2xs text-foreground outline-none focus:border-healthy/30 focus:ring-1 focus:ring-healthy/30"
                  >
                    <option value="">Todos os responsáveis</option>
                    <option value={RESPONSIBLE_UNASSIGNED}>
                      Sem responsável
                    </option>
                    <option value={RESPONSIBLE_AI}>IA</option>
                    <option value={RESPONSIBLE_WORKFLOW}>Fluxo</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.username?.trim() || m.email?.trim() || m.userId}
                      </option>
                    ))}
                  </select>
                </div>
                {availableLabels.length > 0 ? (
                  <div className="flex-1 min-w-0">
                    <label htmlFor={labelFilterId} className="text-2xs font-semibold text-muted-foreground mb-1 block">
                      {tList("filters.label")}
                    </label>
                    <select
                      id={labelFilterId}
                      value={filters.labelId}
                      onChange={(e) => setFilters((f) => ({ ...f, labelId: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-2xs text-foreground outline-none focus:border-healthy/30 focus:ring-1 focus:ring-healthy/30"
                    >
                      <option value="">{tList("filters.anyLabel")}</option>
                      {availableLabels.map((label) => (
                        <option key={label.id} value={label.id}>
                          {label.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-2xs font-semibold text-muted-foreground mb-1 block">
                    De
                  </label>
                  <div className="relative">
                    <CalendarBlank
                      weight="regular"
                      className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, dateFrom: e.target.value }))
                      }
                      className="w-full rounded-lg border border-border bg-card pl-7 pr-2 py-1.5 text-2xs text-foreground outline-none focus:border-healthy/30 focus:ring-1 focus:ring-healthy/30"
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-2xs font-semibold text-muted-foreground mb-1 block">
                    Até
                  </label>
                  <div className="relative">
                    <CalendarBlank
                      weight="regular"
                      className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, dateTo: e.target.value }))
                      }
                      className="w-full rounded-lg border border-border bg-card pl-7 pr-2 py-1.5 text-2xs text-foreground outline-none focus:border-healthy/30 focus:ring-1 focus:ring-healthy/30"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-2xs font-semibold text-muted-foreground mb-1 block">
                    Janela 24h
                  </label>
                  <select
                    value={filters.windowOpen}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        windowOpen: e.target.value as FilterState["windowOpen"],
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-2xs text-foreground outline-none focus:border-healthy/30 focus:ring-1 focus:ring-healthy/30"
                  >
                    <option value="">Todas</option>
                    <option value="true">Aberta</option>
                    <option value="false">Fechada</option>
                  </select>
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-2xs font-semibold text-muted-foreground mb-1 block">
                    Não lidas
                  </label>
                  <select
                    value={filters.hasUnread}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        hasUnread: e.target.value as FilterState["hasUnread"],
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-2xs text-foreground outline-none focus:border-healthy/30 focus:ring-1 focus:ring-healthy/30"
                  >
                    <option value="">Todas</option>
                    <option value="true">Com não lidas</option>
                    <option value="false">Todas lidas</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-2xs font-semibold text-muted-foreground mb-1 block">
                    Mín. msgs
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={filters.minMessageCount}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        minMessageCount: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-2xs text-foreground outline-none focus:border-healthy/30 focus:ring-1 focus:ring-healthy/30"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-2xs font-semibold text-muted-foreground mb-1 block">
                    Máx. msgs
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="∞"
                    value={filters.maxMessageCount}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        maxMessageCount: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-2xs text-foreground outline-none focus:border-healthy/30 focus:ring-1 focus:ring-healthy/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-2xs font-semibold text-muted-foreground mb-1 block">
                  Busca no conteúdo das mensagens
                </label>
                <input
                  type="text"
                  placeholder="Texto dentro das mensagens..."
                  value={filters.messageSearch}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, messageSearch: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-2xs text-foreground placeholder:text-muted-foreground outline-none focus:border-healthy/30 focus:ring-1 focus:ring-healthy/30"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 rounded-lg bg-healthy px-3 py-1.5 text-2xs font-semibold text-healthy-foreground hover:bg-healthy transition-colors"
                >
                  Aplicar filtros
                </button>
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleClearFilters}
                    className="rounded-lg border border-border px-3 py-1.5 text-2xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selecting ? (
        <InboxBulkBar
          targets={pickedTargets}
          headerState={selection.headerState}
          workspaceId={currentWorkspace?.id}
          labels={availableLabels}
          canAssign={can("conversations", "assign")}
          canLabel={can("labels", "assign")}
          canFinish={can("conversations", "send")}
          onToggleAll={selection.toggleAll}
          onDone={leaveSelectionFromToolbar}
          onCancel={leaveSelectionFromToolbar}
          onRead={(read) => personalInbox?.clearUnread(read.map((target) => ({ entry_id: target.entryId, entry_type: target.entryType as EntryType })))}
        />
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {selection.announcement ? tList(`select.${selection.announcement}`) : ""}
      </p>

      <div
        ref={attachList}
        onScroll={handleInboxScroll}
        onPointerEnter={holdOrder}
        onPointerLeave={releaseOrder}
        {...{ [SHORTCUT_SCOPE_ATTRIBUTE]: "inbox" }}
        className="flex-1 overflow-y-auto"
      >
        <InboxUpdatesPill count={listed.pending} onApply={applyHeldUpdates} />
        {isServerSearchActive && allMatchedMessages.length > 0 && (
          <div className="border-b border-border bg-muted">
            <div className="px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MagnifyingGlass
                  weight="bold"
                  className="h-3.5 w-3.5 text-warning-ink"
                />
                <span className="text-2xs font-semibold text-warning-ink">
                  Mensagens encontradas
                </span>
              </div>
              <span className="text-2xs text-warning-ink font-medium tabular-nums">
                {searchTotalItems} conversa{searchTotalItems !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-warning/80">
              {allMatchedMessages.map(
                ({ match, entryId, entryType, leadName }) => (
                  <button
                    key={match.message_id}
                    onClick={() =>
                      onNavigateToMessage?.(
                        entryId,
                        entryType,
                        match.created_at,
                      )
                    }
                    className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-2xs font-semibold text-muted-foreground truncate">
                          {leadName}
                        </span>
                        <span className="text-2xs text-muted-foreground tabular-nums flex-shrink-0">
                          {formatMatchTime(match.created_at)}
                        </span>
                        <ChannelLogo
                          channel={match.channel}
                          className="h-2.5 w-2.5 flex-shrink-0"
                        />
                      </div>
                      <p className="text-2xs text-foreground leading-snug break-words">
                        <HighlightedText
                          text={
                            match.text.length > 120
                              ? match.text.slice(0, 120) + "…"
                              : match.text
                          }
                          query={search.trim() || filters.messageSearch.trim()}
                        />
                      </p>
                    </div>
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {listed.entries.length === 0 ? (
            <InboxEmptyState
              key="empty"
              state={inboxEmptyState({
                query: search,
                filterCount: activeFilterCount,
                status: stateFilter,
                blockedByDepartment,
              })}
              noConversationsText={t.noConversations}
              onClearSearch={() => setSearch("")}
              onClearFilters={handleClearFilters}
              onShowActive={() => handleStateFilterChange("all")}
            />
          ) : (
            sections.map((item, index) => {
              if (item.kind === "header") {
                return (
                  <div key={`section-${item.section}`} className="legend px-4 pb-1 pt-2.5">
                    {tList(`groups.${item.section}`)}
                  </div>
                );
              }
              const entry = item.entry;
              const isSelected = entry.entry_id === selectedEntryId;
              const rowKey = inboxEntryKey(entry);
              const isPicked = selection.picked.has(rowKey);
              const pinned = personal.isPinned(entry);
              const customerWaitingSince = entry.waiting_since;
              const entryName = entry.lead_name || entry.lead_number;
              const conversationStatusMeta = getConversationStatusMeta(
                tStatus,
                entry.conversation_status,
                entry.close_source,
                entry.close_reason,
              );
              const hasUnread = personal.rendersUnread(entry);

              return (
                <motion.div
                  key={`${entry.entry_type}-${entry.entry_id || index}`}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onMouseEnter={(e) => {
                    if (!isSelected) prefetchIntent.start(entry);
                    if (canReadAnalysis && effectiveAnalysis(entry)) {
                      setHoveredEntryId(
                        `${entry.entry_type}-${entry.entry_id}`,
                      );
                      const rect = (
                        e.currentTarget as HTMLElement
                      ).getBoundingClientRect();
                      setHoveredRect({
                        top: rect.top,
                        right: rect.right,
                        height: rect.height,
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    prefetchIntent.cancel();
                    setHoveredEntryId(null);
                  }}
                  className={cn(
                    "relative overflow-visible border-l-2 transition-colors duration-150",
                    isSelected
                      ? "border-l-primary bg-primary/[0.05]"
                      : isPicked
                        ? "border-l-transparent bg-muted"
                        : "border-l-transparent hover:bg-muted",
                  )}
                >
                  <InboxEntryContextMenu entry={entry} actions={menuActions(entry)}>
                    <div
                      role="button"
                      tabIndex={rowKey === tabStop ? 0 : -1}
                      aria-current={isSelected ? "true" : undefined}
                      {...{ [ROW_ATTRIBUTE]: rowKey }}
                      onFocus={(e) => {
                        if (e.target === e.currentTarget) setFocusedKey(rowKey);
                      }}
                      onClick={(e) => {
                        if (selecting) {
                          selection.pick(rowKey, e.shiftKey);
                          return;
                        }
                        onSelect(entry.entry_id, entry.entry_type, "pointer");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === " " && e.target === e.currentTarget) {
                          e.preventDefault();
                          if (selecting) selection.pick(rowKey, false);
                          else onSelect(entry.entry_id, entry.entry_type, "keyboard");
                        }
                      }}
                      className="group relative flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span
                        inert={!selecting}
                        aria-hidden={selecting ? undefined : true}
                        className={cn(
                          "flex h-10 flex-shrink-0 items-center overflow-hidden transition-[width,margin,opacity] duration-150 ease-out motion-reduce:transition-none",
                          selecting ? "w-4 opacity-100" : "-mr-3 w-0 opacity-0",
                        )}
                      >
                        <SelectionCheckbox
                          checked={isPicked}
                          label={tList("row.select", { name: entryName })}
                          tabIndex={-1}
                          onToggle={(e) => {
                            e.stopPropagation();
                            selection.pick(rowKey, e.shiftKey);
                          }}
                        />
                      </span>
                      <div data-row-avatar className="relative flex-shrink-0">
                        <ChannelAvatar
                          name={entry.lead_name || entry.lead_number}
                          pictureUrl={entry.lead_picture}
                          entryType={entry.entry_type}
                          isGroup={entry.is_group}
                          size="md"
                        />
                        {entry.window_open && (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-card bg-healthy"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-sm text-foreground",
                              hasUnread ? "font-semibold" : "font-medium",
                            )}
                          >
                            <HighlightedText text={entry.lead_name || entry.lead_number} query={search} />
                          </span>
                          {pinned ? (
                            <PushPin
                              role="img"
                              aria-hidden={false}
                              aria-label={tList("row.pinned")}
                              className="h-3 w-3 flex-shrink-0 self-center text-muted-foreground"
                            />
                          ) : null}
                          <span
                            className={cn(
                              "flex-shrink-0 text-2xs font-medium",
                              hasUnread ? "text-primary-ink" : "text-muted-foreground",
                            )}
                          >
                            {ageText(entry.last_message_at)}
                          </span>
                          {onOpenInWindow && (
                            <button
                              type="button"
                              aria-label={openInWindowLabel ?? "Open in a window"}
                              title={openInWindowLabel ?? "Open in a window"}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenInWindow(entry);
                              }}
                              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                            >
                              <ArrowSquareOut size={12} weight="bold" />
                            </button>
                          )}
                          <InboxEntryMenuButton />
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <InboxRowPreview
                            entryKey={rowKey}
                            typing={typingByEntry ? typistsIn(typingByEntry, entry.entry_id, entry.entry_type).size > 0 : false}
                            emphasized={hasUnread}
                          >
                            <HighlightedText text={truncate(previewWithAuthor(entry, tInbox("lastMessageYou"), previewSender(entry)), 60)} query={search} />
                          </InboxRowPreview>
                          {entry.unread_count > 0 ? (
                            <span className="flex h-[18px] min-w-[18px] flex-shrink-0 items-center justify-center rounded-[--radius] bg-healthy px-1 text-2xs font-semibold text-healthy-foreground">
                              {entry.unread_count > 99
                                ? "99+"
                                : entry.unread_count}
                            </span>
                          ) : hasUnread ? (
                            <span
                              role="img"
                              aria-label={tList("row.markedUnread")}
                              className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-healthy"
                            />
                          ) : null}
                        </div>

                        <div className="mt-1.5 flex items-center gap-1.5">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex max-w-full items-center gap-1 text-2xs font-medium",
                                conversationStatusMeta.isSilence
                                  ? "text-warning-ink"
                                  : "text-muted-foreground",
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 flex-shrink-0 rounded-full",
                                  conversationStatusMeta.className,
                                )}
                              />
                              <span className="truncate">
                                {conversationStatusMeta.label}
                              </span>
                            </span>
                            {customerWaitingSince ? (
                              <span className="inline-flex max-w-full items-center gap-1 text-2xs font-medium text-muted-foreground">
                                {waitingAlert(customerWaitingSince, now) ? (
                                  <span role="img" aria-label={timeText.waitingAlert} className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warning" />
                                ) : null}
                                <span className="truncate">{timeText.waiting(customerWaitingSince, now)}</span>
                              </span>
                            ) : null}
                            {!ownerLineNamesTheAutomation(entry.assigned_user_id, entry.automation_enabled) && (
                              <AiHandlerChip
                                handler={entry.ai_handler}
                                automationEnabled={entry.automation_enabled}
                                conversationStatus={entry.conversation_status}
                                assignedUserId={entry.assigned_user_id}
                                size="sm"
                              />
                            )}
                            {canReadAnalysis && entry.analysis_phase && (
                              <span
                                title={tAnalysis(`${entry.analysis_phase}Hint`)}
                                className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-card px-2 py-0.5 text-2xs font-medium text-muted-foreground shadow-sm"
                              >
                                {entry.analysis_phase === "queued" ? (
                                  <CircleNotch className="h-3 w-3 animate-spin" weight="bold" />
                                ) : (
                                  <Clock className="h-3 w-3" weight="bold" />
                                )}
                                <span className="truncate">
                                  {tAnalysis(entry.analysis_phase)}
                                </span>
                              </span>
                            )}
                            {entry.stage && (
                              <span className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-card px-2 py-0.5 text-2xs font-medium text-foreground shadow-sm">
                                <span
                                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                  style={{ backgroundColor: entry.stage.color }}
                                />
                                {entry.stage.name}
                              </span>
                            )}
                            {entry.labels?.slice(0, 2).map((label) => (
                              <span
                                key={label.label_id}
                                className="inline-flex items-center rounded-[--radius] px-1.5 py-0.5 text-2xs font-semibold"
                                style={{
                                  backgroundColor: label.color,
                                  color: readableInkFor(label.color),
                                }}
                              >
                                {label.name}
                              </span>
                            ))}
                            {entry.labels && entry.labels.length > 2 && (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const key = `${entry.entry_type}-${entry.entry_id}`;
                                    setExpandedLabelsEntryId(
                                      expandedLabelsEntryId === key ? null : key,
                                    );
                                  }}
                                  className="inline-flex items-center rounded-[--radius] bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground hover:bg-border transition-colors"
                                >
                                  +{entry.labels.length - 2}
                                </button>
                                {expandedLabelsEntryId ===
                                  `${entry.entry_type}-${entry.entry_id}` && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedLabelsEntryId(null);
                                      }}
                                    />
                                    <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-card shadow-lg py-1.5 px-2">
                                      <div className="px-1 pb-1 text-2xs font-semibold text-muted-foreground">
                                        Todos os labels
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {entry.labels.map((label) => (
                                          <span
                                            key={label.label_id}
                                            className="inline-flex items-center rounded-[--radius] px-1.5 py-0.5 text-2xs font-semibold"
                                            style={{
                                              backgroundColor: label.color,
                                              color: readableInkFor(label.color),
                                            }}
                                          >
                                            {label.name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <ConversationViewers entryId={entry.entry_id} entryType={entry.entry_type} />
                          {(entry.available_stages?.length ?? 0) > 0 && (
                            <div className="relative flex-shrink-0">
                              {onEntryStageChange ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const key = `${entry.entry_type}-${entry.entry_id}`;
                                      setTagMenuEntryId(
                                        tagMenuEntryId === key ? null : key,
                                      );
                                    }}
                                    className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                                    title="Mover para outra tag"
                                  >
                                    <TagIcon weight="bold" className="h-3 w-3" />
                                  </button>
                                  {tagMenuEntryId ===
                                    `${entry.entry_type}-${entry.entry_id}` && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-40"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTagMenuEntryId(null);
                                        }}
                                      />
                                      <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-card shadow-lg py-1">
                                        <div className="px-2 py-1 text-2xs font-semibold text-muted-foreground">
                                          Mover para
                                        </div>
                                        {(entry.available_stages ?? []).map((tag) => {
                                          const isCurrentTag =
                                            entry.stage?.stage_id === tag.stage_id;
                                          return (
                                            <button
                                              key={tag.stage_id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isCurrentTag) {
                                                  const currentTagId =
                                                    entry.stage?.stage_id ?? null;
                                                  onEntryStageChange(
                                                    entry.entry_id,
                                                    entry.entry_type,
                                                    tag.stage_id,
                                                    currentTagId,
                                                  );
                                                }
                                                setTagMenuEntryId(null);
                                              }}
                                              disabled={isCurrentTag}
                                              className={cn(
                                                "flex w-full items-center gap-2 px-2 py-1.5 text-left text-2xs transition-colors",
                                                isCurrentTag
                                                  ? "text-muted-foreground cursor-not-allowed"
                                                  : "text-foreground hover:bg-muted",
                                              )}
                                            >
                                              <span
                                                className="h-2.5 w-2.5 rounded-full ring-1 ring-black/5 flex-shrink-0"
                                                style={{
                                                  backgroundColor: tag.color,
                                                }}
                                              />
                                              <span className="truncate">
                                                {tag.name}
                                              </span>
                                              {isCurrentTag && (
                                                <span className="ml-auto text-2xs text-muted-foreground">
                                                  atual
                                                </span>
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </>
                                  )}
                                </>
                              ) : (
                                <TooltipWrapper
                                  content={
                                    noPermissionStageAssign ??
                                    "You don't have permission to manage tags"
                                  }
                                  enabled={true}
                                  side="top"
                                >
                                  <button
                                    disabled
                                    className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground cursor-not-allowed"
                                  >
                                    <TagIcon weight="bold" className="h-3 w-3" />
                                  </button>
                                </TooltipWrapper>
                              )}
                            </div>
                          )}
                        </div>

                        {(entry.assigned_username || entry.campaign_name) && (
                          <div className="mt-1 flex items-center gap-1.5 text-2xs text-muted-foreground">
                            {entry.assigned_username ? (
                              <span className="inline-flex min-w-0 max-w-[60%] items-center gap-1">
                                <AssigneeGlyph
                                  assignedUserId={entry.assigned_user_id}
                                  className="h-3 w-3 flex-shrink-0"
                                />
                                <span className="truncate font-semibold text-foreground/80">
                                  {entry.assigned_username}
                                </span>
                              </span>
                            ) : null}
                            {entry.assigned_username && entry.campaign_name ? (
                              <span className="text-muted-foreground">·</span>
                            ) : null}
                            {entry.campaign_name ? (
                              <span className="min-w-0 truncate">{entry.campaign_name}</span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </InboxEntryContextMenu>

                </motion.div>
              );
            })
          )}
        </AnimatePresence>

        {loadingSearchMore && isServerSearchActive && (
          <div className="flex items-center justify-center py-3">
            <framerMotion.div
              className="h-4 w-4 rounded-full border border-healthy border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
            <span className="ml-2 text-2xs text-muted-foreground">
              {t.loadingMore}
            </span>
          </div>
        )}

        {loadingMore && !isServerSearchActive && (
          <div className="flex items-center justify-center py-3">
            <framerMotion.div
              className="h-4 w-4 rounded-full border border-healthy border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
            <span className="ml-2 text-2xs text-muted-foreground">
              {t.loadingMore}
            </span>
          </div>
        )}
      </div>

      {canReadAnalysis && hoveredRect && hoveredAnalysisRef.current && (
        <AnalysisHoverCard
          analysis={hoveredAnalysisRef.current}
          visible={!!hoveredEntryId && !!currentHoveredAnalysis}
          position="right"
          preset="inbox"
          anchorRect={hoveredRect}
        />
      )}
    </div>
  );
}

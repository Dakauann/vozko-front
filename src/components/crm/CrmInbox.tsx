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
  ChatCircleDots,
  Check,
  Clock,
  CircleNotch,
  Funnel,
  MagnifyingGlass,
  Tag as TagIcon,
  X,
} from "@/components/icons";
import type {
  CampaignType,
  ConnectionStatus,
  EntryType,
  InboxEntry,
  Label,
  MatchedMessage,
  Stage,
  WsSearchInboxPayload,
} from "@/lib/conversations/types";
import type { FunnelStages } from "@/app/actions/stages";
import { getConversationStatusDisplay } from "@/lib/conversations/close-provenance";
import { AiHandlerChip } from "@/components/crm/AiHandlerChip";
import { AssigneeGlyph } from "@/components/crm/AssigneeGlyph";
import { ownerLineNamesTheAutomation } from "@/lib/conversations/attendance-summary";
import {
  RESPONSIBLE_AI,
  RESPONSIBLE_UNASSIGNED,
  RESPONSIBLE_WORKFLOW,
  responsibleFilterPayload,
} from "@/lib/conversations/responsible-filter";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AnalysisHoverCard from "@/components/crm/AnalysisHoverCard";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { cn, readableInkFor } from "@/lib/utils";
import { motion as framerMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  NoDepartmentNotice,
  useBlockedByMissingDepartment,
} from "@/components/dashboard/NoDepartmentNotice";
import {
  listAssignableMembersAction,
  type AssignableMember,
} from "@/app/actions/workspace";


function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffH < 24) return `${diffH}h`;
  if (diffD < 7) return `${diffD}d`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(isoDate));
}

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
  status?: string | null,
  closeSource?: string | null,
  closeReason?: string | null,
) {
  const d = getConversationStatusDisplay(status, closeSource, closeReason);
  return {
    label: d.label,
    className: d.dotClassName,
    isSilence: d.provenance?.isSilence === true,
  };
}


interface CrmInboxProps {
  entries: InboxEntry[];
  selectedEntryId: string | null;
  onSelect: (entryId: string, entryType: EntryType) => void;
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
}



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
}

const CHANNEL_FILTER_LABELS: Record<MessageChannel, string> = {
  whatsapp: "WhatsApp",
  unofficial_whatsapp: "WhatsApp (não oficial)",
  instagram: "Instagram",
  telegram: "Telegram",
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
};

type ConversationStatusFilter = "all" | "new" | "ongoing" | "finished";

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
  return count;
}

export default function CrmInbox({
  entries,
  selectedEntryId,
  onSelect,
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
}: CrmInboxProps) {
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [stateFilter, setStateFilter] =
    useState<ConversationStatusFilter>("all");
  const [tagMenuEntryId, setTagMenuEntryId] = useState<string | null>(null);
  const [labelMenuEntryId, setLabelMenuEntryId] = useState<string | null>(null);
  const [expandedLabelsEntryId, setExpandedLabelsEntryId] = useState<
    string | null
  >(null);
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);
  const [hoveredRect, setHoveredRect] = useState<{
    top: number;
    right: number;
    height: number;
  } | null>(null);
  const hoveredAnalysisRef = useRef<
    import("@/lib/analysis/types").Analysis | null
  >(null);
  const { can, currentWorkspace } = useWorkspace();
  const blockedByDepartment = useBlockedByMissingDepartment();
  const tAnalysis = useTranslations("crmAnalysis");

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
  const inboxListRef = useRef<HTMLDivElement>(null);
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
      }>,
    ): WsSearchInboxPayload => {
      const payload: WsSearchInboxPayload = {
        page: overrides?.page ?? 1,
        page_size: 20,
      };
      const effectiveStatus = overrides?.conversationStatus ?? stateFilter;
      const q = overrides?.query ?? search.trim();
      if (q.length >= 2) payload.query = q;
      if (filters.stageId) payload.stage_id = filters.stageId;
      else if (filters.stageName) payload.stage_name = filters.stageName;
      if (filters.channel)
        payload.channel = filters.channel;
      if (filters.dateFrom)
        payload.date_from = new Date(filters.dateFrom).toISOString();
      if (filters.dateTo) {
        const d = new Date(filters.dateTo);
        d.setHours(23, 59, 59, 999);
        payload.date_to = d.toISOString();
      }
      if (filters.windowOpen === "true") payload.window_open = true;
      else if (filters.windowOpen === "false") payload.window_open = false;
      if (filters.hasUnread === "true") payload.has_unread = true;
      else if (filters.hasUnread === "false") payload.has_unread = false;
      if (filters.minMessageCount)
        payload.min_message_count = Number(filters.minMessageCount);
      if (filters.maxMessageCount)
        payload.max_message_count = Number(filters.maxMessageCount);
      if (filters.messageSearch.trim())
        payload.message_search = filters.messageSearch.trim();
      Object.assign(payload, responsibleFilterPayload(filters.responsibleUserId));
      if (effectiveStatus !== "all")
        payload.conversation_status = effectiveStatus;
      return payload;
    },
    [search, filters, stateFilter],
  );

  const hasAnyFilter =
    search.trim().length >= 2 ||
    countActiveFilters(filters) > 0 ||
    stateFilter !== "all";

  const fireSearch = useCallback(
    (overrides?: Partial<{ query: string; page: number }>) => {
      if (!onSearch) return;
      const payload = buildPayload(overrides);
      const hasContent =
        payload.query ||
        payload.stage_id ||
        payload.stage_name ||
        payload.channel ||
        payload.date_from ||
        payload.date_to ||
        payload.window_open !== undefined ||
        payload.has_unread !== undefined ||
        payload.min_message_count ||
        payload.max_message_count ||
        payload.message_search ||
        payload.responsible_user_id ||
        payload.responsible_unassigned ||
        payload.responsible_kind;
      if (hasContent) {
        onSearch(payload);
      } else {
        onClearSearch?.();
      }
    },
    [onSearch, onClearSearch, buildPayload],
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
      onClearSearch();
    }

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleApplyFilters = useCallback(() => {
    fireSearch();
  }, [fireSearch]);

  const handleClearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    if (search.trim().length < 2) {
      onClearSearch?.();
    } else {
      setTimeout(() => fireSearch(), 0);
    }
  }, [search, onClearSearch, fireSearch]);

  const handleClearAll = useCallback(() => {
    setSearch("");
    setFilters(EMPTY_FILTERS);
    setStateFilter("all");
    setFiltersOpen(false);
    onConversationStatusFilterChange?.("");
    onClearSearch?.();
  }, [onClearSearch, onConversationStatusFilterChange]);

  const isServerSearchActive =
    searchResults !== null && searchResults !== undefined;
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

  const currentHoveredAnalysis = useMemo(() => {
    if (!hoveredEntryId) return null;
    const entry = displayEntries.find(
      (e) => `${e.entry_type}-${e.entry_id}` === hoveredEntryId,
    );
    return entry?.latest_analysis ?? null;
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

  const handleStateFilterChange = useCallback(
    (newFilter: ConversationStatusFilter) => {
      setStateFilter(newFilter);

      onConversationStatusFilterChange?.(newFilter === "all" ? "" : newFilter);

      const hasSearchQuery = search.trim().length >= 2;
      const hasAdvancedFilters = countActiveFilters(filters) > 0;
      const useServerSearch = hasSearchQuery || hasAdvancedFilters;

      if (!useServerSearch) {
        onClearSearch?.();
        return;
      }

      if (onSearch) {
        if (newFilter === "all") {
          const payload = buildPayload({ conversationStatus: newFilter });
          if (
            Object.keys(payload).filter(
              (k) => k !== "page" && k !== "page_size",
            ).length > 0
          ) {
            onSearch(payload);
          } else {
            onClearSearch?.();
          }
        } else {
          const payload = buildPayload({ conversationStatus: newFilter });
          onSearch(payload);
        }
      }
    },
    [
      onSearch,
      onClearSearch,
      onConversationStatusFilterChange,
      buildPayload,
      search,
      filters,
    ],
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
      {
}
      <div className="flex-shrink-0 border-b border-border">
        <div className="flex h-7 items-center gap-2 bg-muted px-3">
          <ChatCircleDots
            weight="regular"
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="legend shrink-0">{t.title}</span>

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

        {}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <MagnifyingGlass
              weight="bold"
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
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

          {}
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
        </div>

        {}
        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-0.5 -mb-0.5">
          {[
            {
              key: "all" as ConversationStatusFilter,
              label: "Ativos",
              count: stateCounts.all,
            },
            {
              key: "new" as ConversationStatusFilter,
              label: "Novos",
              count: stateCounts.new,
            },
            {
              key: "ongoing" as ConversationStatusFilter,
              label: "Em andamento",
              count: stateCounts.ongoing,
            },
            {
              key: "finished" as ConversationStatusFilter,
              label: "Finalizados",
              count: stateCounts.finished,
            },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => handleStateFilterChange(item.key)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-medium whitespace-nowrap transition-all duration-150",
                stateFilter === item.key
                  ? "bg-healthy text-healthy-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-border",
              )}
            >
              {item.label}
              <span
                className={cn(
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-2xs font-semibold",
                  stateFilter === item.key
                    ? "bg-black/20 text-healthy-foreground"
                    : "bg-border text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>

        {}
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

      {}
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
              {}
              <div className="flex gap-2">
                {
}
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

                {}
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

              {}
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
              </div>

              {}
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

              {}
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

              {}
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

              {}
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

              {}
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

      {}
      <div
        ref={inboxListRef}
        onScroll={handleInboxScroll}
        className="flex-1 overflow-y-auto"
      >
        {}
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

        {}
        <AnimatePresence initial={false}>
          {displayEntries.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-[--radius] bg-muted">
                {isServerSearchActive ? (
                  <MagnifyingGlass
                    weight="duotone"
                    className="h-7 w-7 text-muted-foreground"
                  />
                ) : (
                  <ChatCircleDots
                    weight="duotone"
                    className="h-7 w-7 text-muted-foreground"
                  />
                )}
              </div>
              {
}
              {!isServerSearchActive && blockedByDepartment ? (
                <NoDepartmentNotice compact />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isServerSearchActive
                    ? "Nenhum resultado encontrado"
                    : t.noConversations}
                </p>
              )}
              {isServerSearchActive && (
                <button
                  onClick={handleClearAll}
                  className="text-xs font-medium text-healthy-ink hover:text-healthy-ink"
                >
                  Limpar busca
                </button>
              )}
            </motion.div>
          ) : (
            displayEntries.map((entry, index) => {
              const isSelected = entry.entry_id === selectedEntryId;
              const conversationStatusMeta = getConversationStatusMeta(
                entry.conversation_status,
                entry.close_source,
                entry.close_reason,
              );
              const hasUnread = entry.unread_count > 0;

              return (
                <motion.div
                  key={`${entry.entry_type}-${entry.entry_id || index}`}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onMouseEnter={(e) => {
                    if (canReadAnalysis && entry.latest_analysis) {
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
                  onMouseLeave={() => setHoveredEntryId(null)}
                  className={cn(
                    "relative overflow-visible border-l-2 transition-colors duration-150",
                    isSelected
                      ? "border-l-primary bg-primary/[0.05]"
                      : "border-l-transparent hover:bg-muted",
                  )}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(entry.entry_id, entry.entry_type)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(entry.entry_id, entry.entry_type);
                      }
                    }}
                    onContextMenu={(e) => {
                      if (
                        availableLabels.length > 0 &&
                        (onAssignLabel || onRemoveLabel)
                      ) {
                        e.preventDefault();
                        const key = `${entry.entry_type}-${entry.entry_id}`;
                        setLabelMenuEntryId(
                          labelMenuEntryId === key ? null : key,
                        );
                        setTagMenuEntryId(null);
                      }
                    }}
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left relative cursor-pointer"
                  >
                    {
}
                    <div className="relative flex-shrink-0">
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

                    {}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm text-foreground",
                            hasUnread ? "font-semibold" : "font-medium",
                          )}
                        >
                          {entry.lead_name || entry.lead_number}
                        </span>
                        <span
                          className={cn(
                            "flex-shrink-0 text-2xs font-medium",
                            hasUnread ? "text-primary-ink" : "text-muted-foreground",
                          )}
                        >
                          {relativeTime(entry.last_message_at)}
                        </span>
                        {
}
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
                      </div>
                      {}
                      <div className="mt-0.5 flex items-center gap-2">
                        <p
                          className={cn(
                            "min-w-0 flex-1 truncate text-xs",
                            hasUnread
                              ? "font-medium text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {truncate(entry.last_message_preview, 60)}
                        </p>
                        {hasUnread && (
                          <span className="flex h-[18px] min-w-[18px] flex-shrink-0 items-center justify-center rounded-[--radius] bg-healthy px-1 text-2xs font-semibold text-healthy-foreground">
                            {entry.unread_count > 99
                              ? "99+"
                              : entry.unread_count}
                          </span>
                        )}
                      </div>

                      {
}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                          {}
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
                          {
}
                          {!ownerLineNamesTheAutomation(entry.assigned_user_id, entry.automation_enabled) && (
                            <AiHandlerChip
                              handler={entry.ai_handler}
                              automationEnabled={entry.automation_enabled}
                              conversationStatus={entry.conversation_status}
                              assignedUserId={entry.assigned_user_id}
                              size="sm"
                            />
                          )}
                          {
}
                          {canReadAnalysis && entry.analysis_phase && (
                            <span
                              title={tAnalysis(`${entry.analysis_phase}Hint`)}
                              className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-card px-2 py-0.5 text-2xs font-medium text-muted-foreground shadow-sm"
                            >
                              {
}
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
                          {}
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

                        {}
                        {availableTags.length > 0 && (
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
                                {}
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
                                      {availableTags.map((tag) => {
                                        const isCurrentTag =
                                          entry.stage?.stage_id === tag.id;
                                        return (
                                          <button
                                            key={tag.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (!isCurrentTag) {
                                                const currentTagId =
                                                  entry.stage?.stage_id ?? null;
                                                onEntryStageChange(
                                                  entry.entry_id,
                                                  entry.entry_type,
                                                  tag.id,
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

                      {}
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

                      {}
                      {labelMenuEntryId ===
                        `${entry.entry_type}-${entry.entry_id}` && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLabelMenuEntryId(null);
                            }}
                          />
                          <div className="absolute right-4 top-10 z-50 w-52 rounded-[--radius] border border-border bg-card shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="px-3 py-1.5 text-2xs font-semibold text-muted-foreground">
                              Labels
                            </div>
                            <div className="max-h-52 overflow-y-auto">
                              {availableLabels.map((label) => {
                                const isAssigned = entry.labels?.some(
                                  (l) => l.label_id === label.id,
                                );
                                return (
                                  <button
                                    key={label.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isAssigned && onRemoveLabel) {
                                        onRemoveLabel(
                                          label.id,
                                          entry.entry_id,
                                          entry.entry_type,
                                        );
                                      } else if (!isAssigned && onAssignLabel) {
                                        onAssignLabel(
                                          label.id,
                                          entry.entry_id,
                                          entry.entry_type,
                                        );
                                      }
                                      setLabelMenuEntryId(null);
                                    }}
                                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-2xs transition-colors hover:bg-muted"
                                  >
                                    <span
                                      className="h-2.5 w-2.5 rounded-full ring-1 ring-black/5 flex-shrink-0"
                                      style={{ backgroundColor: label.color }}
                                    />
                                    <span className="flex-1 truncate font-medium text-foreground">
                                      {label.name}
                                    </span>
                                    {isAssigned && (
                                      <Check
                                        weight="bold"
                                        className="h-3 w-3 text-chart-4 flex-shrink-0"
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>

        {}
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

        {}
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

      {}
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


function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;

  const parts: { text: string; match: boolean }[] = [];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let lastIdx = 0;

  let idx = lower.indexOf(q, lastIdx);
  while (idx !== -1) {
    if (idx > lastIdx) {
      parts.push({ text: text.slice(lastIdx, idx), match: false });
    }
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    lastIdx = idx + q.length;
    idx = lower.indexOf(q, lastIdx);
  }
  if (lastIdx < text.length) {
    parts.push({ text: text.slice(lastIdx), match: false });
  }

  if (parts.length === 0) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="bg-warning/70 text-warning-foreground rounded-sm px-0.5"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

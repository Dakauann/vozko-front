"use client";

import type {
  AIHandler,
  CampaignType,
  ContainerKind,
  ConversationMessage,
  EntryType,
  InboxEntry,
  MediaType,
  Stage,
  WhatsAppCampaignTypeFilter,
} from "@/lib/conversations/types";
import { getConversationStatusDisplay } from "@/lib/conversations/close-provenance";
import type {
  FunnelColumnState,
  SendButtonWsInput,
} from "@/hooks/use-conversation-ws";
import {
  ArrowSquareOut,
  Bell,
  BellSlash,
  CaretDown,
  CaretLeft,
  ChatCircleDots,
  Check,
  Info,
  PhoneCall,
  Robot,
  InstagramLogo,
  TelegramLogo,
  WhatsappLogo,
} from "@/components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { ComposerDraft } from "./CrmMessageInput";
import CrmConversationView from "./CrmConversationView";
import ScheduleMessageDialog from "./ScheduleMessageDialog";
import ScheduledMessagesPanel from "./ScheduledMessagesPanel";
import type { ScheduledMessage } from "@/lib/scheduled-messages/types";
import { listScheduledMessagesAction } from "@/app/actions/scheduled-messages";
import CrmWallpaper from "./CrmWallpaper";
import ConversationWindowDeck from "./ConversationWindowDeck";
import CrmInbox from "./CrmInbox";
import { AiHandlerChip } from "./AiHandlerChip";
import { WorkflowRunDrawer } from "./WorkflowRunDrawer";
import CrmFunnelView from "./CrmFunnelView";
import CrmListView from "./CrmListView";
import CrmMessageInput from "./CrmMessageInput";
import CrmStageFilter from "./CrmStageFilter";
import CrmStageManager from "./CrmStageManager";
import CrmLabelManager from "./CrmLabelManager";
import OpportunityBoard from "./OpportunityBoard";
import CrmPipelineSelector, {
  ALL_FUNNELS_ID,
  type SelectedPipeline,
} from "./CrmPipelineSelector";
import CreateOpportunityButton from "./CreateOpportunityButton";
import CrmViewSwitcher, { type CrmViewMode } from "./CrmViewSwitcher";
import ConsoleBank from "./ConsoleBank";
import CrmSegmentedToggle from "./CrmSegmentedToggle";
import {
  boardEntryToInboxEntry,
  decodeFilterParam,
  emptyCrmFilter,
  encodeFilterParam,
  type CrmBoardOwner,
  type CrmColumn,
  type CrmFilter,
  type CrmFilterPredicate,
  type CrmGroupBy,
} from "@/lib/crm/board";
import {
  getCrmBoardAction,
  getCrmEntriesAction,
  listPipelinesAction,
} from "@/app/actions/crm-board";
import CrmFilterBar from "./CrmFilterBar";
import CrmSavedViews from "./CrmSavedViews";
import {
  createSavedViewAction,
  deleteSavedViewAction,
  listSavedViewsAction,
  setDefaultSavedViewAction,
  updateSavedViewAction,
} from "@/app/actions/saved-views";
import type { SavedView, SavedViewVisibility } from "@/lib/crm/saved-views";
import { listAssignableMembersAction } from "@/app/actions/workspace";
import {
  assignStageToEntryAction,
} from "@/app/actions/stages";
import {
  assignLabelToEntryAction,
  removeLabelFromEntryAction,
} from "@/app/actions/labels";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { listLeadsQueryAction } from "@/app/actions/leads";
import {
  getCallPermissionStatusAction,
  requestCallPermissionAction,
  type CallPermissionStatus,
} from "@/app/actions/conversations";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import AssignMemberPicker from "@/components/crm/AssignMemberPicker";
import { setConversationAutomationAction } from "@/app/actions/conversations";
import { toast } from "sonner";
import { ChannelAvatar } from "@/components/channels/channel-avatar";
import { cn } from "@/lib/utils";
import { useCrmNotifications } from "@/hooks/use-crm-notifications";
import { useCrm } from "@/contexts/crm-context";
import { StartOfficialConversationDialog } from "@/components/whatsapp/start-official-conversation-dialog";
import { StartConversationDialog } from "@/components/unofficial-whatsapp/start-conversation-dialog";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  requestCall,
  useCallActive,
} from "@/lib/call-session/call-session-control";
import {
  channelCapabilities,
  normalizeEntryType,
} from "@/lib/conversations/types";
import CrmConnectedUsers from "./CrmConnectedUsers";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import ElevatedButton from "../elevated-design/button";
import { useTranslations } from "next-intl";
import CrmConversationInfosPanel from "./CrmConversationInfosPanel";
import { AttendanceOwnerBadge } from "./ConversationAttendanceSection";

export interface CrmTranslations {
  inbox: {
    title: string;
    searchPlaceholder: string;
    noConversations: string;
    connecting: string;
    disconnected: string;
    connected: string;
    loadingMore: string;
  };
  conversation: {
    noConversationSelected: string;
    noConversationDescription: string;
    loadingMore: string;
    windowClosed: string;
    windowClosedDescription: string;
    aiEnabled?: string;
    aiDisabled?: string;
    aiToggleTooltip?: string;
    call?: string;
    callViaWhatsapp?: string;
    comingSoon?: string;
    ringing?: string;
    inCall?: string;
    callEnded?: string;
    callFailed?: string;
    busy?: string;
    noAnswer?: string;
    declined?: string;
    endCall?: string;
    startCall?: string;
    noPermissionStageAssign?: string;
  };
  input: {
    placeholder: string;
    windowClosed: string;
    windowClosedDescription: string;
    windowClosedNoClock: string;
    sendButton: string;
    attachFile: string;
    recording: string;
    uploading: string;
    windowExpires: string;
    noPermissionSend?: string;
  };
  tags?: {
    filter: string;
    clear: string;
    manage: string;
    noTags: string;
    createNew: string;
    namePlaceholder: string;
    setInitial: string;
    saving: string;
    noConversations: string;
    untagged: string;
  };
}

interface CrmLayoutProps {
  campaignId?: string;
  campaignType?: CampaignType;
  containerKind?: ContainerKind;
  channelFilter?: EntryType;
  whatsappCampaignType?: WhatsAppCampaignTypeFilter;
  enabled?: boolean;
  embedded?: boolean;
  translations: CrmTranslations;
  toolbarExtra?: React.ReactNode;
  toolbarBeforeUsers?: React.ReactNode;
}

function coerceGroupBy(value: string): CrmGroupBy {
  return value === "stage" ||
    value === "label" ||
    value === "owner" ||
    value === "none"
    ? value
    : "stage";
}

const BOARD_PAGE_SIZE = 20;

const CHANNEL_BADGES: Record<
  string,
  { className: string; Icon: typeof WhatsappLogo }
> = {
  whatsapp: { className: "bg-healthy", Icon: WhatsappLogo },
  instagram: {
    className: "bg-muted",
    Icon: InstagramLogo,
  },
  telegram: { className: "bg-[#229ED9]", Icon: TelegramLogo },
  unofficial_whatsapp: { className: "bg-muted-foreground", Icon: WhatsappLogo },
};

function columnPredicate(
  groupBy: CrmGroupBy,
  columnId: string,
): CrmFilterPredicate | null {
  if (groupBy === "none" || columnId === "__all__") return null;
  if (groupBy === "owner") {
    if (columnId === "__unassigned__") {
      return { field: "owner", operator: "is_empty", values: [] };
    }
    return { field: "owner", operator: "in", values: [columnId] };
  }
  if (groupBy === "label")
    return { field: "label", operator: "in", values: [columnId] };
  return { field: "stage", operator: "in", values: [columnId] };
}

function withColumnPredicate(
  base: CrmFilter,
  p: CrmFilterPredicate | null,
): CrmFilter {
  if (!p) return base;
  return {
    groups: [...base.groups, { conjunction: "and", predicates: [p] }],
  };
}

export default function CrmLayout({
  campaignId = "",
  campaignType,
  containerKind,
  channelFilter,
  whatsappCampaignType,
  enabled = true,
  embedded = false,
  translations: t,
  toolbarExtra,
  toolbarBeforeUsers,
}: CrmLayoutProps) {
  const tContactPanel = useTranslations("crmContactPanel");
  const tCommon = useTranslations("common");
  const tWindow = useTranslations("liveChat.conversationWindow");
  const tBoard = useTranslations("crmBoard");
  const [mobileShowConversation, setMobileShowConversation] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [workflowDrawerHandler, setWorkflowDrawerHandler] =
    useState<AIHandler | null>(null);
  const [viewMode, setViewMode] = useState<CrmViewMode>("classic");
  const [groupBy, setGroupBy] = useState<CrmGroupBy>("stage");
  const [filter, setFilter] = useState<CrmFilter>(emptyCrmFilter);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const urlHydratedRef = useRef(false);
  const defaultViewAppliedRef = useRef(false);
  const [boardColumns, setBoardColumns] = useState<CrmColumn[] | null>(null);
  const [activePipelineId, setActivePipelineId] = useState<string>("");
  const [selectedPipeline, setSelectedPipeline] =
    useState<SelectedPipeline | null>(null);
  const [defaultConvPipeline, setDefaultConvPipeline] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [filterStageIds, setFilterStageIds] = useState<string[]>([]);
  const [totalContacts, setTotalContacts] = useState<number | null>(null);
  const { can, currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    let cancelled = false;
    void listLeadsQueryAction({ page: 1, pageSize: 1 }).then((result) => {
      if (!cancelled && !result.error) setTotalContacts(result.meta.totalItems);
    });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id]);

  const {
    isMuted,
    toggleMute: toggleNotificationMute,
    playNotificationSound,
    showNotification,
    requestNotificationPermission,
    notificationPermission,
  } = useCrmNotifications();

  const {
    status,
    inbox,
    activeConversation,
    connectedUsers,
    subscribe,
    unsubscribe,
    sendMessage,
    sendMediaMessage,
    sendButtonMessage,
    sendTyping,
    typingUsers,
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
    searchPage,
    searchHasMore,
    requestSearchPage,
    loadingSearchMore,
    searchMessages,
    clearMessageSearch,
    messageSearchResults,
    searchingMessages,
    messageSearchTotalItems,
    messageSearchQuery,
    funnelColumns,
    funnelSummary,
    loadingFunnelColumn,
    requestFunnelColumn,
    requestFunnelSummary,
    tags,
    funnelStages,
    labels,
    reloadStages,
    reloadLabels,
    switchView,
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
  } = useCrm();

  const isCallBusy = useCallActive();

  const hasCampaign = !!campaignId && !!campaignType;
  const isGlobalBoard = !hasCampaign && viewMode === "funnel";
  const isGlobalTable = !hasCampaign && viewMode === "table";
  const showOpportunityBoard =
    !hasCampaign && selectedPipeline?.objectType === "opportunity";


  const stagePipelineId =
    activePipelineId && activePipelineId !== ALL_FUNNELS_ID
      ? activePipelineId
      : undefined;

  useEffect(() => {
    if (!enabled) return;
    reloadStages(campaignId || undefined, campaignType, stagePipelineId);
    reloadLabels();
  }, [
    enabled,
    campaignId,
    campaignType,
    stagePipelineId,
    reloadStages,
    reloadLabels,
  ]);

  useEffect(() => {
    if (!enabled || hasCampaign) return;
    let cancelled = false;
    (async () => {
      const { pipelines } = await listPipelinesAction("conversation");
      if (cancelled) return;
      const def = pipelines.find((p) => p.isDefault) ?? pipelines[0];
      if (def) setDefaultConvPipeline({ id: def.id, name: def.name });
      setActivePipelineId((prev) => prev || (def?.id ?? ""));
      setSelectedPipeline(
        (prev) =>
          prev ??
          (def
            ? { id: def.id, objectType: "conversation", name: def.name }
            : null),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, hasCampaign]);

  const refetchBoard = useCallback(async () => {
    if (!isGlobalBoard) return;
    let owners: CrmBoardOwner[] = [];
    if (groupBy === "owner" && currentWorkspace?.id) {
      const res = await listAssignableMembersAction(currentWorkspace.id, {
        pageSize: 200,
      });
      owners = res.members.map((m) => ({
        id: m.userId,
        name: m.username?.trim() || m.email?.trim() || m.userId,
      }));
    }
    const { board } = await getCrmBoardAction({
      groupBy,
      pipelineId:
        activePipelineId && activePipelineId !== ALL_FUNNELS_ID
          ? activePipelineId
          : undefined,
      filter,
      owners,
      pageSize: BOARD_PAGE_SIZE,
    });
    setBoardColumns(board?.columns ?? []);
  }, [isGlobalBoard, groupBy, activePipelineId, currentWorkspace?.id, filter]);

  const handleSelectPipeline = useCallback((p: SelectedPipeline) => {
    setSelectedPipeline(p);
    if (p.objectType === "conversation") {
      setActivePipelineId(p.id);
    }
  }, []);

  useEffect(() => {
    if (
      groupBy === "stage" &&
      activePipelineId === ALL_FUNNELS_ID &&
      defaultConvPipeline
    ) {
      setActivePipelineId(defaultConvPipeline.id);
      setSelectedPipeline({
        id: defaultConvPipeline.id,
        objectType: "conversation",
        name: defaultConvPipeline.name,
      });
    }
  }, [groupBy, activePipelineId, defaultConvPipeline]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refetchBoard();
    }, 250);
    return () => clearTimeout(t);
  }, [refetchBoard]);

  useEffect(() => {
    if (!isGlobalBoard) return;
    const t = setTimeout(() => {
      void refetchBoard();
    }, 500);
    return () => clearTimeout(t);
  }, [inbox, isGlobalBoard, refetchBoard]);

  const applyView = useCallback((view: SavedView) => {
    setFilter(view.filter ?? emptyCrmFilter);
    setGroupBy(coerceGroupBy(view.groupBy));
    if (view.pipelineId) setActivePipelineId(view.pipelineId);
    setActiveViewId(view.id);
  }, []);

  const handleFilterChange = useCallback((next: CrmFilter) => {
    setFilter(next);
    setActiveViewId(null);
  }, []);

  const handleGroupByChange = useCallback((next: CrmGroupBy) => {
    setGroupBy(next);
    setActiveViewId(null);
  }, []);

  const handleSelectView = useCallback(
    (view: SavedView | null) => {
      if (view) {
        applyView(view);
      } else {
        setFilter(emptyCrmFilter);
        setActiveViewId(null);
      }
    },
    [applyView],
  );

  const reloadSavedViews = useCallback(async () => {
    const { views } = await listSavedViewsAction("conversation");
    setSavedViews(views);
    return views;
  }, []);

  const handleSaveView = useCallback(
    async (name: string, visibility: SavedViewVisibility) => {
      const { view } = await createSavedViewAction({
        name,
        objectType: "conversation",
        pipelineId: activePipelineId || undefined,
        filter,
        groupBy,
        visibility,
      });
      await reloadSavedViews();
      if (view) setActiveViewId(view.id);
    },
    [activePipelineId, filter, groupBy, reloadSavedViews],
  );

  const handleRenameView = useCallback(
    async (id: string, name: string) => {
      await updateSavedViewAction(id, { name });
      await reloadSavedViews();
    },
    [reloadSavedViews],
  );

  const handleUpdateViewToCurrent = useCallback(
    async (id: string) => {
      await updateSavedViewAction(id, {
        filter,
        groupBy,
        pipelineId: activePipelineId || undefined,
      });
      await reloadSavedViews();
      setActiveViewId(id);
    },
    [filter, groupBy, activePipelineId, reloadSavedViews],
  );

  const handleSetViewVisibility = useCallback(
    async (id: string, visibility: SavedViewVisibility) => {
      await updateSavedViewAction(id, { visibility });
      await reloadSavedViews();
    },
    [reloadSavedViews],
  );

  const handleDeleteView = useCallback(
    async (id: string) => {
      await deleteSavedViewAction(id);
      await reloadSavedViews();
      if (activeViewId === id) {
        setActiveViewId(null);
        setFilter(emptyCrmFilter);
      }
    },
    [activeViewId, reloadSavedViews],
  );

  const handleSetDefaultView = useCallback(
    async (id: string) => {
      await setDefaultSavedViewAction(id);
      await reloadSavedViews();
    },
    [reloadSavedViews],
  );

  useEffect(() => {
    if (!enabled || hasCampaign) return;
    void reloadSavedViews().then((views) => {
      if (defaultViewAppliedRef.current) return;
      defaultViewAppliedRef.current = true;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("v") || params.get("f") || params.get("p")) return;
      }
      const def = views.find((v) => v.isDefault);
      if (def) applyView(def);
    });
  }, [enabled, hasCampaign, reloadSavedViews, applyView]);

  useEffect(() => {
    if (urlHydratedRef.current) return;
    urlHydratedRef.current = true;
    if (hasCampaign || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const g = params.get("g");
    if (g === "stage" || g === "label" || g === "owner" || g === "none") {
      setGroupBy(g);
    }
    const f = params.get("f");
    if (f) setFilter(decodeFilterParam(f));
    const v = params.get("v");
    if (v) setActiveViewId(v);
    const p = params.get("p");
    const pt = params.get("pt");
    if (p && (pt === "conversation" || pt === "opportunity")) {
      setSelectedPipeline({
        id: p,
        objectType: pt,
        name: pt === "opportunity" ? "Vendas" : "Atendimento",
      });
      if (pt === "conversation") setActivePipelineId(p);
    }
  }, [hasCampaign]);

  useEffect(() => {
    if (
      !urlHydratedRef.current ||
      hasCampaign ||
      typeof window === "undefined"
    ) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set("g", groupBy);
    if (activeViewId) params.set("v", activeViewId);
    else params.delete("v");
    const f = encodeFilterParam(filter);
    if (f) params.set("f", f);
    else params.delete("f");
    if (selectedPipeline) {
      params.set("p", selectedPipeline.id);
      params.set("pt", selectedPipeline.objectType);
    }
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [groupBy, activeViewId, filter, hasCampaign, selectedPipeline]);

  const handleGlobalBoardReorder = useCallback(() => {
    void refetchBoard();
  }, [refetchBoard]);

  const globalBoardStages = useMemo<Stage[]>(() => {
    if (!boardColumns) return [];
    return boardColumns.map((c, i) => ({
      id: c.id,
      userId: "",
      name: c.name,
      description: "",
      color: c.color || "hsl(var(--plate-neutral))",
      isDefault: false,
      isInitial: false,
      position: i,
      createdAt: "",
      updatedAt: "",
    }));
  }, [boardColumns]);

  const [globalBoardFunnelColumns, setGlobalBoardFunnelColumns] = useState<
    Map<string, FunnelColumnState> | undefined
  >(undefined);

  useEffect(() => {
    if (!boardColumns) {
      setGlobalBoardFunnelColumns(undefined);
      return;
    }
    const map = new Map<string, FunnelColumnState>();
    for (const col of boardColumns) {
      const colEntries = col.entries ?? [];
      const total = col.total ?? 0;
      map.set(col.id, {
        entries: colEntries.map(boardEntryToInboxEntry),
        page: 1,
        pageSize: BOARD_PAGE_SIZE,
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / BOARD_PAGE_SIZE)),
        loading: false,
      });
    }
    setGlobalBoardFunnelColumns(map);
  }, [boardColumns]);

  const handleRequestGlobalColumn = useCallback(
    async (columnId: string, page = 1, pageSize = BOARD_PAGE_SIZE) => {
      if (page <= 1) return;
      setGlobalBoardFunnelColumns((prev) => {
        if (!prev?.has(columnId)) return prev;
        const next = new Map(prev);
        next.set(columnId, { ...next.get(columnId)!, loading: true });
        return next;
      });
      const colFilter = withColumnPredicate(
        filter,
        columnPredicate(groupBy, columnId),
      );
      const { result } = await getCrmEntriesAction({
        filter: colFilter,
        page,
        pageSize,
        sortOrder: "desc",
      });
      setGlobalBoardFunnelColumns((prev) => {
        if (!prev?.has(columnId)) return prev;
        const cur = prev.get(columnId)!;
        const incoming = (result?.entries ?? []).map(boardEntryToInboxEntry);
        const seen = new Set(cur.entries.map((e) => e.entry_id));
        const merged = [
          ...cur.entries,
          ...incoming.filter((e) => !seen.has(e.entry_id)),
        ];
        const next = new Map(prev);
        next.set(columnId, { ...cur, entries: merged, page, loading: false });
        return next;
      });
    },
    [filter, groupBy],
  );

  const globalBoardSummary = useMemo(() => {
    if (!boardColumns) return undefined;
    const map = new Map<string, number>();
    for (const col of boardColumns) map.set(col.id, col.total);
    return map;
  }, [boardColumns]);

  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (!enabled) return;
    if (status !== "connected") {
      prevStatusRef.current = status;
      return;
    }
    const justConnected = prevStatusRef.current !== "connected";
    prevStatusRef.current = status;
    if (justConnected && !campaignId && !campaignType && !whatsappCampaignType)
      return;
    switchView(
      campaignId || undefined,
      campaignType,
      whatsappCampaignType,
      undefined,
      containerKind,
    );
  }, [
    enabled,
    status,
    campaignId,
    campaignType,
    whatsappCampaignType,
    switchView,
  ]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      if (notificationPermission === "default") {
        requestNotificationPermission();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [enabled, notificationPermission, requestNotificationPermission]);

  const prevInboxRef = useRef<typeof inbox>([]);
  const lastNotificationTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || inbox.length === 0) {
      prevInboxRef.current = inbox;
      return;
    }

    const prevInbox = prevInboxRef.current;
    const now = Date.now();

    if (now - lastNotificationTimeRef.current < 1000) {
      prevInboxRef.current = inbox;
      return;
    }

    for (const entry of inbox) {
      const prevEntry = prevInbox.find((e) => e.entry_id === entry.entry_id);
      const prevUnread = prevEntry?.unread_count ?? 0;

      if (prevEntry && entry.unread_count > prevUnread) {
        if (activeConversation?.entry_id === entry.entry_id) {
          continue;
        }

        playNotificationSound();
        lastNotificationTimeRef.current = now;

        showNotification({
          title: entry.lead_name || entry.lead_number || "Nova mensagem",
          body:
            entry.last_message_preview ||
            "VocÃƒÆ’Ã‚Âª recebeu uma nova mensagem",
          tag: `crm-message-${entry.entry_id}`,
          onClick: () => {
            subscribe(entry.entry_id, entry.entry_type);
          },
        });

        break;
      }
    }

    prevInboxRef.current = inbox;
  }, [
    inbox,
    enabled,
    activeConversation?.entry_id,
    playNotificationSound,
    showNotification,
    subscribe,
  ]);

  const filteredInbox = useMemo(() => {
    let list = inbox;
    if (channelFilter) {
      list = list.filter((entry) => entry.entry_type === channelFilter);
    }
    if (filterStageIds.length === 0) return list;
    return list.filter((entry) => {
      return entry.stage && filterStageIds.includes(entry.stage.stage_id);
    });
  }, [inbox, filterStageIds, channelFilter]);

  const handleSelect = useCallback(
    (entryId: string, entryType: EntryType) => {
      subscribe(entryId, entryType);
      setMobileShowConversation(true);
    },
    [subscribe],
  );

  const handleOpenInWindow = useCallback(
    (entry: InboxEntry) => {
      openConversationWindow({
        entryId: entry.entry_id,
        entryType: entry.entry_type,
        leadName: entry.lead_name,
        leadNumber: entry.lead_number,
        leadPicture: entry.lead_picture,
        windowOpen: entry.window_open,
        windowExpiresAt: entry.window_expires_at,
        conversationStatus: entry.conversation_status,
        isGroup: entry.is_group,
      });
    },
    [openConversationWindow],
  );

  const [dockHeightPx, setDockHeightPx] = useState(0);

  const handlePopOutActive = useCallback(() => {
    if (!activeConversation) return;
    openConversationWindow({
      entryId: activeConversation.entry_id,
      entryType: activeConversation.entry_type,
      leadName: activeConversation.lead_name,
      leadNumber: activeConversation.lead_number,
      leadPicture:
        activeConversation.lead_picture ?? currentInboxEntry?.lead_picture,
      windowOpen: activeConversation.window_open,
      windowExpiresAt: activeConversation.window_expires_at,
      conversationStatus: activeConversation.conversation_status,
      isGroup: activeConversation.is_group,
    });
  }, [activeConversation, openConversationWindow]);

  const canStartConversation = can("unofficial_whatsapp_instances", "send");
  const canStartOfficial = can("whatsapp_templates", "send");
  const [startConversationOpen, setStartConversationOpen] = useState(false);
  const [startOfficialOpen, setStartOfficialOpen] = useState(false);

  const handleConversationStarted = useCallback(
    (entryId: string, entryType: string) => {
      handleSelect(entryId, entryType as EntryType);
    },
    [handleSelect],
  );

  const handleBack = useCallback(() => {
    unsubscribe();
    setMobileShowConversation(false);
  }, [unsubscribe]);

  const [replyToMessage, setReplyToMessage] =
    useState<ConversationMessage | null>(null);

  useEffect(() => {
    setReplyToMessage(null);
  }, [activeConversation?.entry_id]);

  const handleSend = useCallback(
    (text: string, signed: boolean) => {
      sendMessage(text, signed, replyToMessage?.id);
      setReplyToMessage(null);
    },
    [sendMessage, replyToMessage],
  );


  const [scheduleDraft, setScheduleDraft] = useState<ComposerDraft | null>(null);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);

  const scheduleEntryType = activeConversation?.entry_type;
  const scheduleEntryId = activeConversation?.entry_id;

  const refreshScheduledMessages = useCallback(() => {
    if (!scheduleEntryType || !scheduleEntryId) {
      setScheduledMessages([]);
      return;
    }
    listScheduledMessagesAction(scheduleEntryType, scheduleEntryId, [
      "pending",
      "sending",
      "failed",
    ]).then((result) => {
      if (!result.error) setScheduledMessages(result.scheduledMessages);
    });
  }, [scheduleEntryId, scheduleEntryType]);

  useEffect(() => {
    refreshScheduledMessages();
  }, [refreshScheduledMessages]);

  const lastMessageId = activeConversation?.messages?.at(-1)?.id;
  useEffect(() => {
    if (lastMessageId) refreshScheduledMessages();
  }, [lastMessageId, refreshScheduledMessages]);

  const handleScheduled = useCallback(
    (message: ScheduledMessage) => {
      setScheduledMessages((current) => [...current, message]);
      setReplyToMessage(null);
    },
    [],
  );

  const handleReuseScheduled = useCallback((message: ScheduledMessage) => {
    setScheduleDraft({
      text: message.text ?? "",
      mediaId: message.mediaId,
      mediaType: message.mediaType,
      replyToMessageId: message.replyToMessageId,
      signed: message.signed,
    });
  }, []);

  const handleSendMedia = useCallback(
    (text: string, mediaId: string, mediaType: MediaType, signed: boolean) => {
      sendMediaMessage(text, mediaId, mediaType, signed, replyToMessage?.id);
      setReplyToMessage(null);
    },
    [sendMediaMessage, replyToMessage],
  );

  const handleSendButton = useCallback(
    (input: SendButtonWsInput) => {
      sendButtonMessage(input, replyToMessage?.id);
      setReplyToMessage(null);
    },
    [sendButtonMessage, replyToMessage],
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      sendTyping(isTyping);
    },
    [sendTyping],
  );

  const isRemoteTyping = useMemo(() => {
    return typingUsers.size > 0;
  }, [typingUsers]);

  const currentEntryStages = useMemo(() => {
    if (!activeConversation) return [];
    const entry = inbox.find((e) => e.entry_id === activeConversation.entry_id);
    return entry?.stage ? [entry.stage] : [];
  }, [activeConversation, inbox]);

  const currentEntryLabels = useMemo(() => {
    if (!activeConversation) return [];
    const entry = inbox.find((e) => e.entry_id === activeConversation.entry_id);
    return entry?.labels ?? [];
  }, [activeConversation, inbox]);

  const entryAvailableStages = useMemo(() => {
    if (!activeConversation) return [];
    const entry = inbox.find((e) => e.entry_id === activeConversation.entry_id);
    return entry?.available_stages ?? [];
  }, [activeConversation, inbox]);

  const handleLoadMoreInbox = useCallback(() => {
    if (inboxHasMore && !loadingInbox) {
      requestInboxPage(Math.ceil(inbox.length / 20) + 1);
    }
  }, [inboxHasMore, loadingInbox, requestInboxPage, inbox.length]);

  const [pendingScrollToMessageId, setPendingScrollToMessageId] = useState<
    string | null
  >(null);

  const handleNavigateToMessage = useCallback(
    (entryId: string, entryType: EntryType, createdAt: string) => {
      setPendingScrollToMessageId(createdAt);

      const alreadyViewing =
        activeConversation?.entry_id === entryId &&
        activeConversation?.entry_type === entryType;
      if (!alreadyViewing) {
        subscribe(entryId, entryType);
      }
      setMobileShowConversation(true);
    },
    [subscribe, activeConversation?.entry_id, activeConversation?.entry_type],
  );

  useEffect(() => {
    if (!activeConversation) {
      setPendingScrollToMessageId(null);
    }
  }, [activeConversation]);

  const handleEntryStageChange = useCallback(
    async (entryId: string, entryType: EntryType, newStageId: string) => {
      const { error } = await assignStageToEntryAction(
        newStageId,
        entryId,
        entryType,
      );
      if (error) {
        toast.error(error);
      }
    },
    [],
  );

  const handleMoveToFunnel = useCallback(
    async (
      entryId: string,
      entryType: EntryType,
      stageId: string,
    ): Promise<string | null> => {
      const { error } = await assignStageToEntryAction(
        stageId,
        entryId,
        entryType,
        true,
      );
      if (error) return error;
      toast.success("Conversa movida para o outro funil");
      return null;
    },
    [],
  );

  const handleStagesReorder = useCallback(() => {
    reloadStages(campaignId || undefined, campaignType, stagePipelineId);
  }, [reloadStages, campaignId, campaignType, stagePipelineId]);

  const handleStagesChange = useCallback(() => {
    reloadStages(campaignId || undefined, campaignType, stagePipelineId);
  }, [reloadStages, campaignId, campaignType, stagePipelineId]);

  const handleAssignLabel = useCallback(
    async (labelId: string, entryId: string, entryType: EntryType) => {
      await assignLabelToEntryAction(labelId, entryId, entryType);
    },
    [],
  );

  const handleRemoveLabel = useCallback(
    async (labelId: string, entryId: string, entryType: EntryType) => {
      await removeLabelFromEntryAction(labelId, entryId, entryType);
    },
    [],
  );

  const handleEntryLabelChange = useCallback(
    async (
      entryId: string,
      entryType: EntryType,
      newLabelId: string,
      oldLabelId: string | null,
    ) => {
      if (newLabelId) {
        await assignLabelToEntryAction(newLabelId, entryId, entryType);
      }
      if (oldLabelId && oldLabelId !== newLabelId) {
        await removeLabelFromEntryAction(oldLabelId, entryId, entryType);
      }
      void refetchBoard();
    },
    [refetchBoard],
  );

  const handleEntryOwnerChange = useCallback(
    async (
      entryId: string,
      entryType: EntryType,
      newOwnerId: string,
      _oldOwnerId: string | null,
    ) => {
      if (newOwnerId && newOwnerId !== "__unassigned__") {
        assignTo(entryId, entryType, newOwnerId);
      }
      void refetchBoard();
    },
    [assignTo, refetchBoard],
  );

  const handleAssignStage = useCallback(
    async (stageId: string, entryId: string, entryType: EntryType) => {
      await assignStageToEntryAction(stageId, entryId, entryType);
    },
    [],
  );

  const handleLabelsChange = useCallback(() => {
    reloadLabels();
  }, [reloadLabels]);

  const [togglingAi, setTogglingAi] = useState(false);
  const [callDropdownOpen, setCallDropdownOpen] = useState(false);
  const { data: whatsappPhones = [], isLoading: loadingCallPhones } = useQuery<WhatsAppBusinessPhone[]>({
    queryKey: ["crm-call-phones", currentWorkspace?.id],
    enabled: enabled && callDropdownOpen && !!currentWorkspace?.id && can("call_session", "use"),
    staleTime: 60_000,
    queryFn: async () => {
      const result = await listBusinessPhonesAction({ status: "CONNECTED", pageSize: 500 });
      if (result.error) throw new Error(result.error);
      return result.phones;
    },
  });
  const callDropdownRef = useRef<HTMLDivElement>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const handleToggleAi = useCallback(async () => {
    if (!activeConversation || togglingAi) return;
    const currentVal = activeConversation.automation_enabled;
    const newVal = currentVal === false ? true : false;
    setTogglingAi(true);
    try {
      await setConversationAutomationAction(
        activeConversation.entry_type,
        activeConversation.entry_id,
        newVal,
      );
    } finally {
      setTogglingAi(false);
    }
  }, [activeConversation, togglingAi]);

  useEffect(() => {
    if (!callDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        callDropdownRef.current &&
        !callDropdownRef.current.contains(e.target as Node)
      ) {
        setCallDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [callDropdownOpen]);

  useEffect(() => {
    if (!statusMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(e.target as Node)
      ) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [statusMenuOpen]);

  const handleWhatsAppCall = useCallback(
    (whatsAppPhoneId: string, whatsAppPhoneLabel?: string) => {
      setCallDropdownOpen(false);
      const phoneNumber = activeConversation?.lead_number ?? "";
      if (!phoneNumber) {
        toast.error(
          t.conversation.callFailed ?? "Número do lead indisponível.",
        );
        return;
      }
      if (!whatsAppPhoneId) {
        toast.error("Número comercial do WhatsApp indisponível.");
        return;
      }
      requestCall({ phoneNumber, whatsAppPhoneId, whatsAppPhoneLabel });
    },
    [activeConversation?.lead_number, t.conversation.callFailed],
  );

  const [requestingPermission, setRequestingPermission] = useState(false);
  const handleRequestCallPermission = useCallback(async () => {
    setCallDropdownOpen(false);
    if (!activeConversation || requestingPermission) return;
    setRequestingPermission(true);
    try {
      const result = await requestCallPermissionAction(
        normalizeEntryType(activeConversation.entry_type),
        activeConversation.entry_id,
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          "Pedido de permissão enviado. Aguardando o cliente aceitar.",
        );
      }
    } finally {
      setRequestingPermission(false);
    }
  }, [activeConversation, requestingPermission]);

  const [callPermission, setCallPermission] =
    useState<CallPermissionStatus | null>(null);
  const [callPermissionLoading, setCallPermissionLoading] = useState(false);

  const callPermissionSignal = useMemo(() => {
    const messages = activeConversation?.messages ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const type = messages[i].message_type;
      if (
        type === "call_permission_granted" ||
        type === "call_permission_rejected"
      ) {
        return messages[i].id;
      }
    }
    return "";
  }, [activeConversation?.messages]);

  useEffect(() => {
    if (!activeConversation) {
      setCallPermission(null);
      return;
    }
    const entryType = normalizeEntryType(activeConversation.entry_type);
    if (entryType !== "whatsapp") {
      setCallPermission({ status: "none", can_call: false });
      return;
    }
    const entryId = activeConversation.entry_id;
    let cancelled = false;
    setCallPermissionLoading(true);
    getCallPermissionStatusAction(entryType, entryId)
      .then((result) => {
        if (cancelled) return;
        setCallPermission(result.status ?? { status: "none", can_call: false });
      })
      .finally(() => {
        if (!cancelled) setCallPermissionLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeConversation?.entry_id,
    activeConversation?.entry_type,
    callPermissionSignal,
  ]);

  const currentInboxEntry = useMemo(() => {
    if (!activeConversation) return null;
    return (
      inbox.find(
        (e) =>
          e.entry_id === activeConversation.entry_id &&
          e.entry_type === activeConversation.entry_type,
      ) ?? null
    );
  }, [inbox, activeConversation]);

  const currentConversationStatus = useMemo(() => {
    const status =
      currentInboxEntry?.conversation_status ??
      activeConversation?.conversation_status;
    if (status === "ongoing" || status === "finished" || status === "new") {
      return status;
    }
    return "new" as const;
  }, [
    activeConversation?.conversation_status,
    currentInboxEntry?.conversation_status,
  ]);

  const currentCloseSource =
    activeConversation?.close_source ?? currentInboxEntry?.close_source ?? null;
  const currentCloseReason =
    activeConversation?.close_reason ?? currentInboxEntry?.close_reason ?? null;

  const currentConversationStatusMeta = useMemo(() => {
    return getConversationStatusDisplay(
      currentConversationStatus,
      currentCloseSource,
      currentCloseReason,
    );
  }, [currentConversationStatus, currentCloseSource, currentCloseReason]);

  const conversationStatusActions = useMemo(() => {
    switch (currentConversationStatus) {
      case "finished":
        return [] as Array<{ value: "ongoing" | "finished"; label: string }>;
      case "ongoing":
        return [
          { value: "finished" as const, label: "Marcar como finalizada" },
        ];
      default:
        return [
          { value: "ongoing" as const, label: "Marcar em andamento" },
          { value: "finished" as const, label: "Marcar como finalizada" },
        ];
    }
  }, [currentConversationStatus]);

  const onlineUserIdSet = useMemo(
    () => new Set(connectedUsers.map((u) => u.user_id)),
    [connectedUsers],
  );

  const handleAssignTo = useCallback(
    (userId: string) => {
      if (!activeConversation) return;
      assignTo(
        activeConversation.entry_id,
        activeConversation.entry_type,
        userId,
      );
    },
    [activeConversation, assignTo],
  );

  const handleConversationStatusChange = useCallback(
    (nextStatus: "ongoing" | "finished") => {
      if (!activeConversation) return;
      setConversationStatus(
        activeConversation.entry_id,
        activeConversation.entry_type,
        nextStatus,
      );
      setStatusMenuOpen(false);
    },
    [activeConversation, setConversationStatus],
  );

  const aiIsActive = activeConversation?.automation_enabled !== false;

  const hasAiHandler =
    currentInboxEntry?.ai_handler?.kind === "agent" ||
    currentInboxEntry?.ai_handler?.kind === "workflow";
  const canToggleAi =
    !!activeConversation &&
    channelCapabilities.supportsAiHandling(activeConversation.entry_type);

  const [togglingWindowAutomation, setTogglingWindowAutomation] =
    useState(false);
  const handleWindowToggleAutomation = useCallback(
    async (entryId: string, entryType: EntryType) => {
      if (togglingWindowAutomation) return;
      const current = windowConversations.get(
        `${entryType}-${entryId}`,
      )?.conversation.automation_enabled;
      setTogglingWindowAutomation(true);
      try {
        await setConversationAutomationAction(
          entryType,
          entryId,
          current === false,
        );
      } finally {
        setTogglingWindowAutomation(false);
      }
    },
    [togglingWindowAutomation, windowConversations],
  );

  const windowActions = useMemo(
    () => ({
      workspaceId: currentWorkspace?.id,
      onlineUserIds: onlineUserIdSet,
      canAssign: can("conversations", "assign"),
      canSetStatus: can("conversations", "send"),
      canToggleAutomation: can("conversations", "update"),
      canAssignStage: can("stages", "assign"),
      canAssignLabel: can("labels", "assign"),
      togglingAutomation: togglingWindowAutomation,
      stages: tags,
      funnelStages,
      labels,
      resolve: (entryId: string, entryType: EntryType) => {
        const entry = inbox.find(
          (e) => e.entry_id === entryId && e.entry_type === entryType,
        );
        return {
          assignedUserId: entry?.assigned_user_id ?? null,
          currentStages: entry?.stage ? [entry.stage] : [],
          availableStages: entry?.available_stages ?? [],
          currentLabels: entry?.labels ?? [],
        };
      },
      onAssign: assignTo,
      onSetStatus: setConversationStatus,
      onToggleAutomation: handleWindowToggleAutomation,
      onEntryStageChange: handleEntryStageChange,
      onAssignStage: handleAssignStage,
      onMoveToFunnel: can("stages", "transfer") ? handleMoveToFunnel : undefined,
      onAssignLabel: handleAssignLabel,
      onRemoveLabel: handleRemoveLabel,
    }),
    [
      currentWorkspace?.id,
      onlineUserIdSet,
      can,
      togglingWindowAutomation,
      tags,
      funnelStages,
      labels,
      inbox,
      assignTo,
      setConversationStatus,
      handleWindowToggleAutomation,
      handleEntryStageChange,
      handleAssignStage,
      handleMoveToFunnel,
      handleAssignLabel,
      handleRemoveLabel,
    ],
  );

  const conversationHeader = activeConversation ? (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border bg-card px-3 py-2.5 sm:px-4">
      {}
      <button
        type="button"
        onClick={handleBack}
        aria-label="Back"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted lg:hidden"
      >
        <CaretLeft weight="bold" className="h-4 w-4 text-muted-foreground" />
      </button>

      {
}
      <ChannelAvatar
        name={activeConversation.lead_name || activeConversation.lead_number}
        pictureUrl={currentInboxEntry?.lead_picture}
        entryType={activeConversation.entry_type}
        isGroup={activeConversation.is_group ?? currentInboxEntry?.is_group}
        size="md"
      />

      {}
      <div className="min-w-0 flex-1 basis-[10rem]">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">
            {activeConversation.lead_name || activeConversation.lead_number}
          </p>
          {currentInboxEntry?.assigned_user_id ||
          currentInboxEntry?.assigned_username ? (
            <AttendanceOwnerBadge
              kind={
                String(currentInboxEntry.assigned_user_id ?? "").startsWith(
                  "ai:",
                )
                  ? "ai"
                  : "human"
              }
              className="shrink-0"
            />
          ) : aiIsActive && hasAiHandler ? (
            <AttendanceOwnerBadge kind="ai_active" className="shrink-0" />
          ) : (
            <AttendanceOwnerBadge kind="unassigned" className="shrink-0" />
          )}
          {
}
          {channelCapabilities.supportsAiHandling(
            activeConversation.entry_type as EntryType,
          ) && (
            <AiHandlerChip
              handler={currentInboxEntry?.ai_handler}
              automationEnabled={activeConversation.automation_enabled}
              conversationStatus={activeConversation.conversation_status}
              assignedUserId={currentInboxEntry?.assigned_user_id}
              size="md"
              onOpenWorkflow={setWorkflowDrawerHandler}
              className="shrink-0"
            />
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {activeConversation.lead_number}
        </p>
      </div>

      {}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
        {}
        {can("conversations", "update") && (
          <CreateOpportunityButton
            entryId={activeConversation.entry_id}
            entryType={activeConversation.entry_type}
            leadName={
              activeConversation.lead_name || activeConversation.lead_number
            }
            workspaceId={currentWorkspace?.id}
          />
        )}

        {
}
        <TooltipWrapper content={tWindow("openInWindow")}>
          <button
            type="button"
            onClick={handlePopOutActive}
            aria-label={tWindow("openInWindow")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowSquareOut className="h-4 w-4" />
          </button>
        </TooltipWrapper>

        {}
        {viewMode !== "funnel" && (
          <TooltipWrapper content={tContactPanel("toggleTooltip")}>
            <button
              type="button"
              onClick={() => setInfoPanelOpen((prev) => !prev)}
              aria-pressed={infoPanelOpen}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                infoPanelOpen
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Info
                weight={infoPanelOpen ? "fill" : "regular"}
                className="h-4 w-4"
              />
            </button>
          </TooltipWrapper>
        )}

        {}
        <TooltipWrapper
          content={t.conversation.aiToggleTooltip ?? "Toggle AI responses"}
        >
          <ElevatedButton
            variant={aiIsActive ? "primary" : "outline-subtle"}
            size="sm"
            onClick={handleToggleAi}
            disabled={togglingAi || !canToggleAi}
            title={
              aiIsActive
                ? (t.conversation.aiEnabled ?? "Automação")
                : (t.conversation.aiDisabled ?? "Automação Off")
            }
            icon={
              <Robot
                weight={aiIsActive ? "fill" : "regular"}
                className={cn("h-3.5 w-3.5", togglingAi && "animate-pulse")}
              />
            }
            iconVisible
          />
        </TooltipWrapper>

        {currentInboxEntry && (
          <div className="relative" ref={statusMenuRef}>
            <TooltipWrapper
              content={
                can("conversations", "send")
                  ? "Gerenciar status da conversa"
                  : "Status atual da conversa"
              }
            >
              <button
                type="button"
                onClick={() => {
                  if (!can("conversations", "send")) return;
                  setStatusMenuOpen((open) => !open);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-1.5 text-2xs font-semibold text-foreground transition-colors",
                  can("conversations", "send") && "hover:bg-muted",
                  !can("conversations", "send") && "cursor-default opacity-90",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    currentConversationStatusMeta.dotClassName,
                  )}
                />
                <span className="max-w-[11rem] truncate">
                  {currentConversationStatusMeta.label}
                </span>
                {can("conversations", "send") && (
                  <CaretDown weight="bold" className="h-3.5 w-3.5 shrink-0" />
                )}
              </button>
            </TooltipWrapper>

            {statusMenuOpen && can("conversations", "send") && (
              <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-[--radius] border border-border bg-card shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="border-b border-border px-3 py-2">
                  <div className="text-2xs font-semibold text-muted-foreground">
                    Status atual
                  </div>
                  <div
                    className={cn(
                      "mt-1 text-xs font-semibold",
                      currentConversationStatusMeta.menuAccentClassName,
                    )}
                  >
                    {currentConversationStatusMeta.baseLabel}
                  </div>
                  {currentConversationStatusMeta.provenance ? (
                    <div className="mt-1.5 space-y-0.5 rounded-lg bg-muted px-2.5 py-2">
                      <div className="text-2xs text-muted-foreground">
                        Encerrada por{" "}
                        <span className="font-medium text-foreground">
                          {currentConversationStatusMeta.provenance.by}
                        </span>
                      </div>
                      <div className="text-2xs text-muted-foreground">
                        Motivo:{" "}
                        <span className="font-medium text-foreground">
                          {currentConversationStatusMeta.provenance.reasonLabel}
                        </span>
                      </div>
                      {currentConversationStatusMeta.provenance.isSilence ? (
                        <div className="text-2xs font-medium text-warning-ink">
                          Encerrada automaticamente por silêncio
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {conversationStatusActions.length > 0 ? (
                  <div className="py-1">
                    {conversationStatusActions.map((action) => (
                      <button
                        key={action.value}
                        type="button"
                        onClick={() =>
                          handleConversationStatusChange(action.value)
                        }
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        <Check
                          weight="bold"
                          className="h-3.5 w-3.5 text-muted-foreground"
                        />
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Reabre automaticamente quando o cliente enviar uma nova
                    mensagem.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {}
        {can("conversations", "assign") && currentWorkspace?.id && (
          <AssignMemberPicker
            workspaceId={currentWorkspace.id}
            assignedUserId={currentInboxEntry?.assigned_user_id ?? null}
            onlineUserIds={onlineUserIdSet}
            onAssign={handleAssignTo}
          />
        )}

        {}
        <div className="relative" ref={callDropdownRef}>
          {
}
          {can("call_session", "use") &&
            channelCapabilities.supportsCalling(
              activeConversation.entry_type as EntryType,
            ) && (
              <TooltipWrapper content={t.conversation.startCall ?? "Ligar"}>
                <button
                  onClick={() => setCallDropdownOpen((v) => !v)}
                  disabled={isCallBusy}
                  className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-full transition-all duration-200",
                    isCallBusy
                      ? "bg-healthy text-healthy-foreground cursor-not-allowed"
                      : "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground",
                  )}
                >
                  <PhoneCall
                    weight={isCallBusy ? "fill" : "regular"}
                    className="h-4 w-4"
                  />
                </button>
              </TooltipWrapper>
            )}

          {callDropdownOpen && can("call_session", "use") && (
            <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-[--radius] border border-border bg-card shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {
}
              {(() => {
                if (loadingCallPhones) {
                  return <div role="status" className="px-3 py-2 text-xs text-muted-foreground">{tCommon("loading")}</div>;
                }
                const openEntry = inbox.find(
                  (e) => e.entry_id === activeConversation?.entry_id,
                );
                const leadNumber = activeConversation?.lead_number;
                const openEntryIsWa =
                  !!openEntry &&
                  normalizeEntryType(openEntry.entry_type) === "whatsapp";
                const sameLeadWaEntry = leadNumber
                  ? inbox.find(
                      (e) =>
                        e.lead_number === leadNumber &&
                        normalizeEntryType(e.entry_type) === "whatsapp" &&
                        !!e.business_phone_id,
                    )
                  : undefined;
                const resolvedPhoneId =
                  (openEntryIsWa ? openEntry?.business_phone_id : "") ||
                  sameLeadWaEntry?.business_phone_id ||
                  (whatsappPhones.length === 1 ? whatsappPhones[0].id : "");
                const resolvedPhone = whatsappPhones.find(
                  (p) => p.id === resolvedPhoneId,
                );

                if (resolvedPhoneId) {
                  if (callPermissionLoading || !callPermission?.can_call) {
                    return (
                      <button
                        disabled
                        title={
                          callPermissionLoading
                            ? undefined
                            : "O cliente precisa autorizar ligações pelo WhatsApp antes de você ligar."
                        }
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-muted-foreground cursor-not-allowed"
                      >
                        <WhatsappLogo weight="bold" className="h-3.5 w-3.5" />
                        <span className="truncate">
                          {t.conversation.callViaWhatsapp ?? "WhatsApp"}
                        </span>
                        <span className="ml-auto text-2xs font-semibold text-muted-foreground">
                          {callPermissionLoading
                            ? "Verificando…"
                            : "Permissão necessária"}
                        </span>
                      </button>
                    );
                  }
                  return (
                    <button
                      onClick={() =>
                        handleWhatsAppCall(
                          resolvedPhoneId,
                          resolvedPhone?.verifiedName ||
                            resolvedPhone?.displayPhoneNumber,
                        )
                      }
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <WhatsappLogo
                        weight="bold"
                        className="h-3.5 w-3.5 text-healthy-ink"
                      />
                      <span className="truncate">
                        {t.conversation.callViaWhatsapp ?? "WhatsApp"}
                      </span>
                      {resolvedPhone && (
                        <span className="ml-auto text-2xs text-muted-foreground truncate">
                          {resolvedPhone.displayPhoneNumber}
                        </span>
                      )}
                    </button>
                  );
                }

                if (whatsappPhones.length === 0) {
                  return (
                    <button
                      disabled
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-muted-foreground cursor-not-allowed"
                    >
                      <WhatsappLogo weight="bold" className="h-3.5 w-3.5" />
                      <span>
                        {t.conversation.callViaWhatsapp ?? "WhatsApp"}
                      </span>
                      <span className="ml-auto text-2xs font-semibold text-muted-foreground">
                        Indisponível
                      </span>
                    </button>
                  );
                }

                return (
                  <>
                    <div className="px-3 py-1.5 text-2xs font-semibold text-muted-foreground">
                      {t.conversation.callViaWhatsapp ?? "WhatsApp"}
                    </div>
                    {whatsappPhones.map((phone) => (
                      <button
                        key={phone.id}
                        onClick={() =>
                          handleWhatsAppCall(
                            phone.id,
                            phone.verifiedName || phone.displayPhoneNumber,
                          )
                        }
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <WhatsappLogo
                          weight="bold"
                          className="h-3.5 w-3.5 text-healthy-ink"
                        />
                        <span className="truncate">
                          {phone.verifiedName || phone.displayPhoneNumber}
                        </span>
                        {phone.verifiedName && (
                          <span className="ml-auto text-2xs text-muted-foreground truncate">
                            {phone.displayPhoneNumber}
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                );
              })()}

              {
}
              {can("conversations", "call") && (
                <>
                  <div className="my-1 border-t border-border" />
                  <button
                    onClick={handleRequestCallPermission}
                    disabled={requestingPermission}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors",
                      requestingPermission
                        ? "text-muted-foreground cursor-not-allowed"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <WhatsappLogo
                      weight="bold"
                      className="h-3.5 w-3.5 text-warning-ink"
                    />
                    <span>
                      {requestingPermission
                        ? "Enviando…"
                        : "Solicitar permissão de ligação"}
                    </span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        className={cn(
          "flex flex-col overflow-hidden",
          embedded
            ? "h-full bg-card"
            :
              "h-[calc(100vh-188px)] min-h-[500px] rounded-[--radius] border border-border bg-card",
        )}
      >
        {
}
        <div className="flex shrink-0 flex-col border-b border-border bg-card sm:flex-row sm:items-stretch">
          {
}
          <div className="flex min-w-0 items-stretch overflow-x-auto sm:flex-1">
            {
}
            {!hasCampaign &&
              (viewMode === "funnel" || showOpportunityBoard) && (
                <ConsoleBank legend={tBoard("bank.funnel")}>
                  <CrmPipelineSelector
                    value={selectedPipeline}
                    onChange={handleSelectPipeline}
                    disableAllFunnels={groupBy === "stage"}
                    canCreate={can("stages", "create")}
                  />
                </ConsoleBank>
              )}

            {hasCampaign && (
              <ConsoleBank legend={tBoard("bank.tags")}>
                <TooltipWrapper content={tBoard("toolbar.filterByTags")}>
                  <CrmStageFilter
                    stages={tags}
                    selectedStageIds={filterStageIds}
                    onSelectionChange={setFilterStageIds}
                  />
                </TooltipWrapper>
              </ConsoleBank>
            )}

            {toolbarExtra}

            {isGlobalBoard && !showOpportunityBoard && (
              <ConsoleBank legend={tBoard("bank.axis")}>
                <CrmSegmentedToggle
                  bare
                  options={[
                    { value: "stage", label: tBoard("axis.stage") },
                    { value: "label", label: tBoard("axis.label") },
                    { value: "owner", label: tBoard("axis.owner") },
                  ]}
                  value={groupBy}
                  onChange={(v) => handleGroupByChange(v as CrmGroupBy)}
                />
              </ConsoleBank>
            )}

            {!showOpportunityBoard && (
              <ConsoleBank legend={tBoard("bank.view")}>
                <CrmViewSwitcher
                  bare
                  mode={viewMode}
                  onChange={setViewMode}
                  showTable={!hasCampaign}
                />
              </ConsoleBank>
            )}
          </div>

          <div className="flex min-w-0 shrink-0 items-stretch border-t border-border sm:border-l sm:border-t-0">
            {(canStartConversation || canStartOfficial) && (
              <ConsoleBank legend={tBoard("bank.outbound")}>
                {canStartOfficial && (
                  <TooltipWrapper content={tBoard("toolbar.startOfficialHint")}>
                    {
}
                    <ElevatedButton
                      variant="outline-subtle"
                      size="sm"
                      onClick={() => setStartOfficialOpen(true)}
                      title={tBoard("toolbar.startOfficial")}
                      titleClassName="hidden sm:inline"
                      icon={<WhatsappLogo size={16} weight="bold" />}
                      iconVisible
                      iconSide="left"
                    />
                  </TooltipWrapper>
                )}
                {canStartConversation && (
                <TooltipWrapper
                  content={tBoard("toolbar.startConversationHint")}
                >
                  {
}
                  <ElevatedButton
                    variant="outline-subtle"
                    size="sm"
                    onClick={() => setStartConversationOpen(true)}
                    title={tBoard("toolbar.startConversation")}
                    titleClassName="hidden sm:inline"
                    icon={<ChatCircleDots size={16} weight="bold" />}
                    iconVisible
                    iconSide="left"
                  />
                </TooltipWrapper>
                )}
              </ConsoleBank>
            )}

            {!showOpportunityBoard && (
              <ConsoleBank legend={tBoard("bank.manage")}>
                <TooltipWrapper content={tBoard("toolbar.manageTags")}>
                  <CrmStageManager
                    stages={tags}
                    onStagesChange={handleStagesChange}
                    campaignId={campaignId}
                    campaignType={campaignType}
                    pipelineId={stagePipelineId}
                  />
                </TooltipWrapper>
                {can("labels", "read") && (
                  <TooltipWrapper content={tBoard("toolbar.manageLabels")}>
                    <CrmLabelManager
                      labels={labels}
                      onLabelsChange={handleLabelsChange}
                      canCreate={can("labels", "create")}
                      canUpdate={can("labels", "update")}
                      canDelete={can("labels", "delete")}
                    />
                  </TooltipWrapper>
                )}
              </ConsoleBank>
            )}

            <ConsoleBank legend={tBoard("bank.session")}>
              {toolbarBeforeUsers}
              <CrmConnectedUsers connectedUsers={connectedUsers} />
              <TooltipWrapper
                content={
                  isMuted ? tBoard("toolbar.muteOff") : tBoard("toolbar.muteOn")
                }
              >
                <ElevatedButton
                  variant="outline-subtle"
                  size="sm"
                  aria-label={
                    isMuted
                      ? tBoard("toolbar.muteOff")
                      : tBoard("toolbar.muteOn")
                  }
                  onClick={toggleNotificationMute}
                  icon={
                    isMuted ? (
                      <BellSlash size={16} weight="bold" />
                    ) : (
                      <Bell size={16} weight="fill" />
                    )
                  }
                  iconVisible
                />
              </TooltipWrapper>
            </ConsoleBank>
          </div>
        </div>

        {
}
        {(isGlobalBoard || isGlobalTable) && !showOpportunityBoard && (
          <>
            <CrmSavedViews
              views={savedViews}
              activeViewId={activeViewId}
              onSelect={handleSelectView}
              onSave={handleSaveView}
              onRename={
                can("conversations", "update") ? handleRenameView : undefined
              }
              onUpdateToCurrent={
                can("conversations", "update")
                  ? handleUpdateViewToCurrent
                  : undefined
              }
              onSetVisibility={
                can("conversations", "update")
                  ? handleSetViewVisibility
                  : undefined
              }
              onDelete={
                can("conversations", "update") ? handleDeleteView : undefined
              }
              onSetDefault={
                can("conversations", "update")
                  ? handleSetDefaultView
                  : undefined
              }
              canManage={can("conversations", "update")}
            />
            <CrmFilterBar
              value={filter}
              onChange={handleFilterChange}
              labels={labels}
              stages={tags}
              workspaceId={currentWorkspace?.id}
            />
          </>
        )}

        {
}
        <div
          className="relative flex flex-1 min-h-0 overflow-hidden transition-[padding] duration-150"
          style={dockHeightPx > 0 ? { paddingBottom: dockHeightPx } : undefined}
        >
          {showOpportunityBoard ? (
            <OpportunityBoard
              pipelineId={selectedPipeline?.id}
              workspaceId={currentWorkspace?.id}
              canEdit={can("conversations", "update")}
              embedded
            />
          ) : viewMode === "funnel" ? (
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-w-0 overflow-hidden">
                <CrmFunnelView
                  entries={isGlobalBoard ? [] : filteredInbox}
                  stages={isGlobalBoard ? globalBoardStages : tags}
                  selectedEntryId={activeConversation?.entry_id ?? null}
                  onSelect={handleSelect}
                  onStagesReorder={
                    isGlobalBoard
                      ? handleGlobalBoardReorder
                      : handleStagesReorder
                  }
                  onEntryStageChange={
                    isGlobalBoard
                      ? groupBy === "stage" && can("stages", "assign")
                        ? handleEntryStageChange
                        : groupBy === "label" && can("labels", "assign")
                          ? handleEntryLabelChange
                          : groupBy === "owner" &&
                              can("conversations", "assign")
                            ? handleEntryOwnerChange
                            : undefined
                      : can("stages", "assign")
                        ? handleEntryStageChange
                        : undefined
                  }
                  funnelColumns={
                    isGlobalBoard ? globalBoardFunnelColumns : funnelColumns
                  }
                  funnelSummary={
                    isGlobalBoard ? globalBoardSummary : funnelSummary
                  }
                  loadingFunnelColumn={
                    isGlobalBoard ? null : loadingFunnelColumn
                  }
                  onRequestColumn={
                    isGlobalBoard
                      ? handleRequestGlobalColumn
                      : requestFunnelColumn
                  }
                  onRequestSummary={
                    isGlobalBoard ? undefined : requestFunnelSummary
                  }
                  labels={labels}
                  onAssignLabel={handleAssignLabel}
                  onRemoveLabel={handleRemoveLabel}
                  funnelStages={funnelStages}
                  onMoveToFunnel={
                    can("stages", "transfer") ? handleMoveToFunnel : undefined
                  }
                />
              </div>

              {}
              {activeConversation && (
                <div className="relative isolate w-[420px] flex-shrink-0 border-l border-border flex flex-col">
                  <CrmWallpaper />
                  {conversationHeader}
                  <div className="flex-1 min-h-0">
                    <CrmConversationView
                      conversation={activeConversation}
                      isTyping={isRemoteTyping}
                      onLoadMore={loadHistory}
                      loadingHistory={loadingHistory}
                      loadingConversation={loadingConversation}
                      translations={t.conversation}
                      onSearchMessages={searchMessages}
                      onClearMessageSearch={clearMessageSearch}
                      messageSearchResults={messageSearchResults}
                      searchingMessages={searchingMessages}
                      messageSearchTotalItems={messageSearchTotalItems}
                      messageSearchQuery={messageSearchQuery}
                      scrollToMessageTimestamp={pendingScrollToMessageId}
                      onScrolledToMessage={() =>
                        setPendingScrollToMessageId(null)
                      }
                      onLoadAround={loadAround}
                      onReply={setReplyToMessage}
                      tags={tags}
                      currentEntryTags={currentEntryStages}
                      entryAvailableTags={entryAvailableStages}
                      funnelStages={funnelStages}
                      onMoveToFunnel={
                        can("stages", "transfer") ? handleMoveToFunnel : undefined
                      }
                      onEntryStageChange={
                        can("stages", "assign")
                          ? handleEntryStageChange
                          : undefined
                      }
                      onAssignStage={
                        can("stages", "assign") ? handleAssignStage : undefined
                      }
                      availableLabels={labels}
                      currentEntryLabels={currentEntryLabels}
                      onAssignLabel={
                        can("labels", "assign") ? handleAssignLabel : undefined
                      }
                      onRemoveLabel={
                        can("labels", "assign") ? handleRemoveLabel : undefined
                      }
                    />
                  </div>
                  <ScheduledMessagesPanel
                    messages={scheduledMessages}
                    canManage={can("conversations", "send")}
                    onChanged={refreshScheduledMessages}
                    onReuse={handleReuseScheduled}
                  />
                  <CrmMessageInput
                    entryType={activeConversation.entry_type}
                    entryId={activeConversation.entry_id}
                    onSend={handleSend}
                    onSendMedia={handleSendMedia}
                    onSendButton={handleSendButton}
                    onTyping={handleTyping}
                    onSchedule={
                      can("conversations", "send") ? setScheduleDraft : undefined
                    }
                    windowOpen={activeConversation.window_open}
                    windowExpiresAt={activeConversation.window_expires_at}
                    windowClosedReason={activeConversation.window_closed_reason}
                    translations={t.input}
                    replyToMessage={replyToMessage}
                    onClearReply={() => setReplyToMessage(null)}
                    disabled={!can("conversations", "send")}
                    disabledReason={
                      !can("conversations", "send")
                        ? (t.input.noPermissionSend ??
                          "You don't have permission to send messages")
                        : undefined
                    }
                  />
                </div>
              )}
            </div>
          ) : isGlobalTable ? (
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <CrmListView
                filter={filter}
                stages={tags}
                labels={labels}
                workspaceId={currentWorkspace?.id}
                canAssignStage={can("stages", "assign")}
                canAssignOwner={can("conversations", "assign")}
                canAssignLabel={can("labels", "assign")}
                canMoveToFunnel={can("stages", "transfer")}
                funnelStages={funnelStages}
              />
            </div>
          ) : (
            <>
              {
}
              <div
                data-tour="live-chat-inbox"
                className={cn(
                  "w-full border-r border-border lg:w-[356px] lg:flex-shrink-0",
                  mobileShowConversation
                    ? "hidden lg:flex lg:flex-col"
                    : "flex flex-col",
                )}
              >
                <CrmInbox
                  entries={filteredInbox}
                  selectedEntryId={activeConversation?.entry_id ?? null}
                  onSelect={handleSelect}
                  onOpenInWindow={handleOpenInWindow}
                  openInWindowLabel={tWindow("openInWindow")}
                  connectionStatus={status}
                  onLoadMore={handleLoadMoreInbox}
                  hasMore={inboxHasMore}
                  inboxTotalItems={inboxTotalItems}
                  totalContacts={totalContacts}
                  conversationStatusCounts={conversationStatusCounts}
                  loadingMore={loadingInbox}
                  tags={tags}
                  funnelStages={funnelStages}
                  campaignType={campaignType}
                  translations={t.inbox}
                  onSearch={searchInbox}
                  onClearSearch={clearSearch}
                  searchResults={searchResults}
                  searching={searching}
                  searchTotalItems={searchTotalItems}
                  searchTotalPages={searchTotalPages}
                  searchPage={searchPage}
                  searchHasMore={searchHasMore}
                  onLoadMoreSearch={requestSearchPage}
                  loadingSearchMore={loadingSearchMore}
                  onConversationStatusFilterChange={(statusFilter) =>
                    switchView(
                      campaignId || undefined,
                      campaignType,
                      whatsappCampaignType,
                      statusFilter,
                    )
                  }
                  onNavigateToMessage={handleNavigateToMessage}
                  labels={labels}
                  onAssignLabel={handleAssignLabel}
                  onRemoveLabel={handleRemoveLabel}
                  onEntryStageChange={
                    can("stages", "assign") ? handleEntryStageChange : undefined
                  }
                  noPermissionStageAssign={
                    t.conversation.noPermissionStageAssign
                  }
                />
              </div>

              {}
              <div
                data-tour="live-chat-conversation"
                className={cn(
                  "relative isolate flex-1 flex flex-col min-w-0",
                  !mobileShowConversation && !activeConversation
                    ? "hidden lg:flex"
                    : "flex",
                  mobileShowConversation
                    ? "flex"
                    : !activeConversation
                      ? ""
                      : "hidden lg:flex",
                )}
              >
                {
}
                <CrmWallpaper />
                {conversationHeader}

                <div className="flex-1 min-h-0">
                  <CrmConversationView
                    conversation={activeConversation}
                    isTyping={isRemoteTyping}
                    onLoadMore={loadHistory}
                    loadingHistory={loadingHistory}
                    loadingConversation={loadingConversation}
                    translations={t.conversation}
                    onSearchMessages={searchMessages}
                    onClearMessageSearch={clearMessageSearch}
                    messageSearchResults={messageSearchResults}
                    searchingMessages={searchingMessages}
                    messageSearchTotalItems={messageSearchTotalItems}
                    messageSearchQuery={messageSearchQuery}
                    scrollToMessageTimestamp={pendingScrollToMessageId}
                    onScrolledToMessage={() =>
                      setPendingScrollToMessageId(null)
                    }
                    onLoadAround={loadAround}
                    onReply={setReplyToMessage}
                    tags={tags}
                    currentEntryTags={currentEntryStages}
                    entryAvailableTags={entryAvailableStages}
                    funnelStages={funnelStages}
                    onMoveToFunnel={
                      can("stages", "transfer") ? handleMoveToFunnel : undefined
                    }
                    onEntryStageChange={
                      can("stages", "assign")
                        ? handleEntryStageChange
                        : undefined
                    }
                    onAssignStage={
                      can("stages", "assign") ? handleAssignStage : undefined
                    }
                    availableLabels={labels}
                    currentEntryLabels={currentEntryLabels}
                    onAssignLabel={
                      can("labels", "assign") ? handleAssignLabel : undefined
                    }
                    onRemoveLabel={
                      can("labels", "assign") ? handleRemoveLabel : undefined
                    }
                  />
                </div>

                {activeConversation && (
                  <>
                  <ScheduledMessagesPanel
                    messages={scheduledMessages}
                    canManage={can("conversations", "send")}
                    onChanged={refreshScheduledMessages}
                    onReuse={handleReuseScheduled}
                  />
                  <CrmMessageInput
                    entryType={activeConversation.entry_type}
                    entryId={activeConversation.entry_id}
                    onSend={handleSend}
                    onSendMedia={handleSendMedia}
                    onSendButton={handleSendButton}
                    onTyping={handleTyping}
                    onSchedule={
                      can("conversations", "send") ? setScheduleDraft : undefined
                    }
                    windowOpen={activeConversation.window_open}
                    windowExpiresAt={activeConversation.window_expires_at}
                    windowClosedReason={activeConversation.window_closed_reason}
                    translations={t.input}
                    replyToMessage={replyToMessage}
                    onClearReply={() => setReplyToMessage(null)}
                    disabled={!can("conversations", "send")}
                    disabledReason={
                      !can("conversations", "send")
                        ? (t.input.noPermissionSend ??
                          "You don't have permission to send messages")
                        : undefined
                    }
                  />
                  </>
                )}
              </div>
            </>
          )}
          {activeConversation && (
            <CrmConversationInfosPanel
              open={infoPanelOpen}
              onClose={() => setInfoPanelOpen(false)}
              conversation={activeConversation}
              inboxEntry={currentInboxEntry}
              conversationStatus={currentConversationStatus}
              canBlock={can("leads", "block")}
              canManageMemories={can("leads", "update")}
              canRenameLead={can("leads", "update")}
              onLeadRenamed={applyLeadRename}
            />
          )}
          <WorkflowRunDrawer
            handler={workflowDrawerHandler}
            open={!!workflowDrawerHandler}
            onOpenChange={(open) => {
              if (!open) setWorkflowDrawerHandler(null);
            }}
          />
        </div>
      </div>

      {
}
      {canStartConversation && (
        <StartConversationDialog
          open={startConversationOpen}
          onOpenChange={setStartConversationOpen}
          onStarted={handleConversationStarted}
        />
      )}

      {canStartOfficial && (
        <StartOfficialConversationDialog
          open={startOfficialOpen}
          onOpenChange={setStartOfficialOpen}
          onStarted={handleConversationStarted}
        />
      )}

      {
}
      {scheduleDraft && scheduleEntryType && scheduleEntryId && (
        <ScheduleMessageDialog
          open
          onOpenChange={(open) => {
            if (!open) setScheduleDraft(null);
          }}
          entryType={scheduleEntryType}
          entryId={scheduleEntryId}
          recipientName={activeConversation?.lead_name}
          window={{
            open: activeConversation?.window_open ?? false,
            expiresAt: activeConversation?.window_expires_at ?? null,
          }}
          draft={scheduleDraft}
          onScheduled={handleScheduled}
        />
      )}

      {
}
      <ConversationWindowDeck
        conversations={windowConversations}
        focusRequest={windowFocusRequest}
        actions={windowActions}
        canSend={can("conversations", "send")}
        noPermissionSend={t.input.noPermissionSend}
        translations={{
          conversation: t.conversation,
          input: t.input,
          minimize: tWindow("minimize"),
          restore: tWindow("restore"),
          maximize: tWindow("maximize"),
          close: tWindow("close"),
          dragHint: tWindow("dragHint"),
          actions: {
            actions: tWindow("actions"),
            statusHeading: tWindow("statusHeading"),
            markOngoing: tWindow("markOngoing"),
            markFinished: tWindow("markFinished"),
            automationOn: tWindow("automationOn"),
            automationOff: tWindow("automationOff"),
          },
        }}
        onClose={closeConversationWindow}
        onVisibilityChange={setConversationWindowVisible}
        onDockHeightChange={setDockHeightPx}
        onLoadHistory={windowLoadHistory}
        onSend={windowSendMessage}
        onSendMedia={windowSendMedia}
        onSendButton={windowSendButton}
        onTyping={windowSendTyping}
      />
    </>
  );
}

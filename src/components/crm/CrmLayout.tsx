"use client";

import type {
  AIHandler,
  CampaignType,
  ConversationMessage,
  EntryType,
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
  Bell,
  BellSlash,
  CaretDown,
  CaretLeft,
  ChatCircleDots,
  Check,
  Info,
  Phone,
  PhoneCall,
  Robot,
  InstagramLogo,
  TelegramLogo,
  WhatsappLogo,
} from "@/components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ComposerDraft } from "./CrmMessageInput";
import CrmConversationView from "./CrmConversationView";
import ScheduleMessageDialog from "./ScheduleMessageDialog";
import ScheduledMessagesPanel from "./ScheduledMessagesPanel";
import type { ScheduledMessage } from "@/lib/scheduled-messages/types";
import { listScheduledMessagesAction } from "@/app/actions/scheduled-messages";
import CrmWallpaper from "./CrmWallpaper";
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
  removeStageFromEntryAction,
} from "@/app/actions/stages";
import {
  assignLabelToEntryAction,
  removeLabelFromEntryAction,
} from "@/app/actions/labels";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
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
import { StartConversationDialog } from "@/components/unofficial-whatsapp/start-conversation-dialog";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  requestDialerCall,
  useDialerCallActive,
} from "@/lib/dialer/dialer-control";
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
  /**
   * Narrows the inbox to one channel, for channels that have no campaigns of
   * their own. Undefined means "every channel".
   */
  channelFilter?: EntryType;
  whatsappCampaignType?: WhatsAppCampaignTypeFilter;
  enabled?: boolean;
  embedded?: boolean;
  translations: CrmTranslations;
  toolbarExtra?: React.ReactNode;
  /** Rendered immediately before the connected-users control (e.g. live ops metrics). */
  toolbarBeforeUsers?: React.ReactNode;
}

// A saved view may carry an axis the global board doesn't render (carteira /
// custom); fall back to the stage axis so the switcher stays valid.
function coerceGroupBy(value: string): CrmGroupBy {
  return value === "stage" ||
    value === "label" ||
    value === "owner" ||
    value === "none"
    ? value
    : "stage";
}

// Cards fetched per column page. Matches CrmFunnelView's hard-coded onLoadMore
// page size so the board's first page and its "load more" pages stay aligned.
const BOARD_PAGE_SIZE = 20;

/**
 * Channel badge for the conversation header.
 *
 * An operator working several inboxes has to be able to tell at a glance where a
 * reply will be sent. This is a registry rather than a chain of ternaries so a
 * new channel is one entry and never silently falls through to the phone icon,
 * which is what "unknown" looks like here.
 */
const CHANNEL_BADGES: Record<
  string,
  { className: string; Icon: typeof WhatsappLogo }
> = {
  whatsapp: { className: "bg-healthy", Icon: WhatsappLogo },
  instagram: {
    className: "bg-muted",
    Icon: InstagramLogo,
  },
  // Telegram blue, the brand's own #229ED9 rather than the nearest Tailwind sky.
  telegram: { className: "bg-[#229ED9]", Icon: TelegramLogo },
  // Same glyph as WhatsApp because it IS WhatsApp to the customer, but a
  // muted-foreground chip rather than the healthy green: an operator has to be
  // able to tell at a glance which transport a reply will leave on, since the
  // two send from different numbers with different rules. Falling through to
  // the default here would render a phone icon, which is what "unknown" looks
  // like — the exact bug this registry exists to prevent.
  unofficial_whatsapp: { className: "bg-muted-foreground", Icon: WhatsappLogo },
};

// The predicate that isolates one board column, mirroring the backend
// crmboard.withPredicate: stage/label/owner columns append an `in` predicate, the
// owner "unassigned" swimlane an `is_empty`, and none/__all__ add nothing. Used to
// page a single column through /crm/entries.
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

// base filter AND (column predicate), matching the backend's per-column narrowing.
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
  channelFilter,
  whatsappCampaignType,
  enabled = true,
  embedded = false,
  translations: t,
  toolbarExtra,
  toolbarBeforeUsers,
}: CrmLayoutProps) {
  const tContactPanel = useTranslations("crmContactPanel");
  const tBoard = useTranslations("crmBoard");
  const [mobileShowConversation, setMobileShowConversation] = useState(false);
  // Closed by default; opened on demand via the info button in the header.
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  // Read-only workflow-run viewer, opened from the header's Fluxo chip.
  const [workflowDrawerHandler, setWorkflowDrawerHandler] =
    useState<AIHandler | null>(null);
  const [viewMode, setViewMode] = useState<CrmViewMode>("classic");
  // Board axis for the workspace-global (no-campaign) funnel. Stored in local
  // state; the campaign WS funnel path is always grouped by stage and ignores it.
  const [groupBy, setGroupBy] = useState<CrmGroupBy>("stage");
  // Global-board filter (from the filter bar / a saved view), synced to the URL.
  const [filter, setFilter] = useState<CrmFilter>(emptyCrmFilter);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const urlHydratedRef = useRef(false);
  const defaultViewAppliedRef = useRef(false);
  const [boardColumns, setBoardColumns] = useState<CrmColumn[] | null>(null);
  const [activePipelineId, setActivePipelineId] = useState<string>("");
  // The unified Funil selection: which pipeline (conversation OR opportunity) the
  // board currently shows. Drives whether we render the conversation board or the
  // deal board on the SAME surface.
  const [selectedPipeline, setSelectedPipeline] =
    useState<SelectedPipeline | null>(null);
  // The workspace default conversation funnel, kept so we can snap back to a concrete
  // funnel when the user switches to the stage axis while on "Todos os funis".
  const [defaultConvPipeline, setDefaultConvPipeline] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [filterStageIds, setFilterStageIds] = useState<string[]>([]);
  const [whatsappPhones, setWhatsappPhones] = useState<WhatsAppBusinessPhone[]>(
    [],
  );
  const { can, currentWorkspace } = useWorkspace();

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
    labels,
    reloadStages,
    reloadLabels,
    switchView,
    assignTo,
    setConversationStatus,
  } = useCrm();

  const isDialerBusy = useDialerCallActive();

  // A campaign is now an OPTIONAL scope, not a hard gate. With no campaign the
  // board runs workspace-global, driven by GET /crm/board; with a campaign the
  // existing WS funnel path is used.
  const hasCampaign = !!campaignId && !!campaignType;
  const isGlobalBoard = !hasCampaign && viewMode === "funnel";
  // "Tabela" is a THIRD, additional view mode: a flat DashboardTable that shares
  // the board filter. It never replaces the classic inbox ("Lista" / CrmInbox),
  // which stays exactly as-is in both campaign and global modes.
  const isGlobalTable = !hasCampaign && viewMode === "table";
  // The unified board shows the DEAL board whenever an opportunity pipeline is
  // selected (global surface only), INDEPENDENT of viewMode, deals have their own
  // board and no Lista/Tabela variants. Keeping it independent means the user's
  // conversation viewMode (Lista/Kanban/Tabela) is preserved when they switch back.
  const showOpportunityBoard =
    !hasCampaign && selectedPipeline?.objectType === "opportunity";

  // Scope breadcrumb copy. A funnel only scopes the Kanban / deal board; Chat and
  // Tabela are inherently cross-funnel, so they always read "Todos os funis".

  useEffect(() => {
    if (!enabled) return;
    reloadStages(campaignId || undefined, campaignType);
    reloadLabels();
  }, [enabled, campaignId, campaignType, reloadStages, reloadLabels]);

  // Resolve the workspace-global conversation pipeline (default, else first) so
  // the global board scopes to it. An empty id still returns all global stages.
  useEffect(() => {
    if (!enabled || hasCampaign) return;
    let cancelled = false;
    (async () => {
      const { pipelines } = await listPipelinesAction("conversation");
      if (cancelled) return;
      const def = pipelines.find((p) => p.isDefault) ?? pipelines[0];
      if (def) setDefaultConvPipeline({ id: def.id, name: def.name });
      // Only fall back to the default when nothing is already selected. This effect
      // resolves AFTER the network round-trip, so an unguarded set would clobber a
      // funnel the URL-hydration effect restored synchronously ("selector shows X but
      // the board renders the default on initial load").
      setActivePipelineId((prev) => prev || (def?.id ?? ""));
      // Seed the unified selector with the default conversation funnel (unless the
      // user has already picked one this session).
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

  // Fetch the global board columns for the current axis. The owner axis needs the
  // workspace assignable members as its columns (plus the backend's trailing
  // "Sem responsável" swimlane).
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
      // "Todos os funis" (sentinel) → no pipeline scope: the backend reads an absent
      // pipelineId as the workspace-wide view for the global owner/label axes.
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

  // Unified Funil selector: pick a conversation OR opportunity pipeline. A
  // conversation pipeline scopes the conversation board (activePipelineId); an
  // opportunity pipeline flips the surface to the deal board. Switching to the deal
  // board forces funnel mode (it has no list/table view).
  const handleSelectPipeline = useCallback((p: SelectedPipeline) => {
    setSelectedPipeline(p);
    // Only conversation funnels drive the conversation board's pipeline scope; the
    // viewMode is left untouched so switching funnels preserves Lista/Kanban/Tabela.
    if (p.objectType === "conversation") {
      setActivePipelineId(p.id);
    }
  }, []);

  // Stage columns are pipeline-specific, so "Todos os funis" can't render them. If the
  // user is on the global scope and switches to the etapa axis, snap back to a concrete
  // funnel (the default) so the stage board always has real columns.
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

  // Initial load + reload on axis / pipeline / filter / mode change. Debounced
  // so a burst of filter-bar edits collapses into a single board fetch.
  useEffect(() => {
    const t = setTimeout(() => {
      void refetchBoard();
    }, 250);
    return () => clearTimeout(t);
  }, [refetchBoard]);

  // WS broadcasts (stage_update / entry_update, ...) mutate the shared inbox; a
  // debounced refetch keeps the global board in sync without a bespoke channel.
  useEffect(() => {
    if (!isGlobalBoard) return;
    const t = setTimeout(() => {
      void refetchBoard();
    }, 500);
    return () => clearTimeout(t);
  }, [inbox, isGlobalBoard, refetchBoard]);

  // Apply a saved view's filter + groupBy (+ pinned pipeline) in one shot.
  const applyView = useCallback((view: SavedView) => {
    setFilter(view.filter ?? emptyCrmFilter);
    setGroupBy(coerceGroupBy(view.groupBy));
    if (view.pipelineId) setActivePipelineId(view.pipelineId);
    setActiveViewId(view.id);
  }, []);

  // Editing the filter bar or the axis diverges from the active saved view, so
  // drop the active-view highlight; the URL still carries the raw filter/axis.
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

  // Overwrite a saved view's filter + groupBy (+ pinned pipeline) with the board's
  // current state, so "Atualizar com filtros atuais" persists what the user tuned.
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

  // Load the workspace's conversation saved views for the global board, then apply
  // the default view ONCE on first load unless the URL already deep-links a view
  // or a raw filter (a shared link always wins over the personal default).
  useEffect(() => {
    if (!enabled || hasCampaign) return;
    void reloadSavedViews().then((views) => {
      if (defaultViewAppliedRef.current) return;
      defaultViewAppliedRef.current = true;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        // A deep link that already pins state (view / filter / funnel) wins over the
        // default saved view, so its pinned pipeline can't clobber the restored funnel.
        if (params.get("v") || params.get("f") || params.get("p")) return;
      }
      const def = views.find((v) => v.isDefault);
      if (def) applyView(def);
    });
  }, [enabled, hasCampaign, reloadSavedViews, applyView]);

  // Hydrate groupBy / active view / filter from the URL once on mount so a
  // shared link deep-links into the same board state.
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
    // Deep-link the selected funnel (id + object type). The name resolves once the
    // selector loads its pipeline lists; a placeholder keeps the trigger sensible.
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

  // Reflect groupBy / active view / filter back into the URL (replace, no
  // history spam) once hydration has run.
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

  // Adapt the fetched board columns into the shapes CrmFunnelView already renders:
  // columns become "stages", entries become a funnel-column map + summary.
  const globalBoardStages = useMemo<Stage[]>(() => {
    if (!boardColumns) return [];
    return boardColumns.map((c, i) => ({
      id: c.id,
      userId: "",
      name: c.name,
      description: "",
      color: c.color || "#94a3b8",
      isDefault: false,
      isInitial: false,
      position: i,
      createdAt: "",
      updatedAt: "",
    }));
  }, [boardColumns]);

  // Per-column state for the global board. Seeded (page 1) from the board fetch,
  // then grown by handleRequestGlobalColumn so a column with more than one page of
  // cards can "load more" instead of silently capping at the first page.
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
      // Go serializes an empty column's `entries` (a nil slice) as null, so guard
      // before mapping, an empty stage/label/owner column must not crash the board.
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

  // Fetch and append the next page of ONE column via /crm/entries with the column
  // predicate appended to the active filter (the same narrowing the board does
  // server-side per column). Reuses the shared filter engine; no bespoke endpoint.
  const handleRequestGlobalColumn = useCallback(
    async (columnId: string, page = 1, pageSize = BOARD_PAGE_SIZE) => {
      if (page <= 1) return; // page 1 already arrives with the board fetch
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
    switchView(campaignId || undefined, campaignType, whatsappCampaignType);
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
    let cancelled = false;
    (async () => {
      const result = await listBusinessPhonesAction({
        status: "CONNECTED",
        pageSize: 500,
      });
      if (!cancelled && !result.error) {
        setWhatsappPhones(result.phones);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

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
    // Channels without campaigns (Instagram, Telegram) are selected by CHANNEL
    // rather than by campaign type, so the toolbar's choice narrows the list
    // here. WhatsApp and voice keep flowing through campaignType, which also
    // drives the campaign sub-filters.
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

  // Cold outbound on the unofficial WhatsApp channel. Gated on the SEND
  // permission rather than on update: replying is attendance, but messaging a
  // stranger is the action that gets an unofficial number banned, so an
  // attendant with full attendance rights does not get it by default.
  const canStartConversation = can("unofficial_whatsapp_instances", "send");
  const [startConversationOpen, setStartConversationOpen] = useState(false);

  const handleConversationStarted = useCallback(
    (entryId: string, entryType: string) => {
      // Straight into the thread that was just opened, so the operator lands
      // where they can type rather than hunting for it in the list.
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

  /* ------------------------------ scheduling ------------------------------ */

  const [scheduleDraft, setScheduleDraft] = useState<ComposerDraft | null>(null);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);

  const scheduleEntryType = activeConversation?.entry_type;
  const scheduleEntryId = activeConversation?.entry_id;

  const refreshScheduledMessages = useCallback(() => {
    if (!scheduleEntryType || !scheduleEntryId) {
      setScheduledMessages([]);
      return;
    }
    // Delivered messages are excluded: they are already in the history above,
    // and listing them again would make the panel a second, worse transcript.
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

  // A dispatched message arrives as an ordinary new message, so the panel is
  // stale by at most one frame rather than needing a websocket event of its own.
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

  // "Try again" on a failed message re-opens the dialog with its content, so
  // the operator picks a new time rather than losing what they wrote. No new
  // endpoint and no second composer path.
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
    async (
      entryId: string,
      entryType: EntryType,
      newStageId: string,
      oldStageId: string | null,
    ) => {
      await assignStageToEntryAction(newStageId, entryId, entryType);
      if (oldStageId && oldStageId !== "__unstaged__") {
        await removeStageFromEntryAction(oldStageId, entryId, entryType);
      }
    },
    [],
  );

  const handleStagesReorder = useCallback(() => {
    reloadStages(campaignId || undefined, campaignType);
  }, [reloadStages, campaignId, campaignType]);

  const handleStagesChange = useCallback(() => {
    reloadStages(campaignId || undefined, campaignType);
  }, [reloadStages, campaignId, campaignType]);

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

  // Global-board drag on the LABEL axis: dropping a card on another label column
  // adds the target label and drops the source one (same actions the card's
  // right-click menu uses), then reconciles the board.
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

  // Global-board drag on the OWNER axis: dropping a card reassigns the responsável;
  // the "Sem responsável" swimlane (__unassigned__) clears it.
  const handleEntryOwnerChange = useCallback(
    async (
      entryId: string,
      entryType: EntryType,
      newOwnerId: string,
      _oldOwnerId: string | null,
    ) => {
      // Reassign to a real member. There is no backend path to CLEAR an owner via
      // drag (assign_to requires a user_id), so dropping on the "Sem responsável"
      // swimlane is a no-op; the board refetch snaps the optimistic card back.
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

  const handleRemoveStage = useCallback(
    async (stageId: string, entryId: string, entryType: EntryType) => {
      await removeStageFromEntryAction(stageId, entryId, entryType);
    },
    [],
  );

  const handleLabelsChange = useCallback(() => {
    reloadLabels();
  }, [reloadLabels]);

  const [togglingAi, setTogglingAi] = useState(false);
  const [callDropdownOpen, setCallDropdownOpen] = useState(false);
  const callDropdownRef = useRef<HTMLDivElement>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const handleToggleAi = useCallback(async () => {
    if (!activeConversation || togglingAi) return;
    // Addressed by conversation, not by campaign. The previous version resolved
    // a campaign id and returned early when it found none, which is every
    // Instagram and Telegram conversation, so the button silently did nothing.
    const currentVal = activeConversation.automation_enabled;
    const newVal = currentVal === false ? true : false;
    setTogglingAi(true);
    try {
      await setConversationAutomationAction(
        activeConversation.entry_type,
        activeConversation.entry_id,
        newVal,
      );
      // The WS entry_update event will sync the state
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
      requestDialerCall({ phoneNumber, whatsAppPhoneId, whatsAppPhoneLabel });
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

  // Whether the lead has an active (granted, not expired) WhatsApp call
  // permission. The backend is the source of truth and also enforces it at call
  // time; we gate the WhatsApp call button on it and fail closed when unknown.
  const [callPermission, setCallPermission] =
    useState<CallPermissionStatus | null>(null);
  const [callPermissionLoading, setCallPermissionLoading] = useState(false);

  // The lead's in-thread grant/reject arrives as a message; re-checking when the
  // latest such message changes keeps the button fresh without polling.
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
    // Only WhatsApp/voice conversations can place a WhatsApp call at all.
    if (entryType !== "whatsapp" && entryType !== "voice") {
      setCallPermission({ status: "none", can_call: false });
      return;
    }
    const entryId = activeConversation.entry_id;
    let cancelled = false;
    setCallPermissionLoading(true);
    getCallPermissionStatusAction(entryType, entryId)
      .then((result) => {
        if (cancelled) return;
        // Fail closed: an error or missing status leaves calling disabled.
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

  // Toggle state for the robot button (backend: null defaults to true).
  // Header owner badge uses assignee first; see AttendanceOwnerBadge below.
  const aiIsActive = activeConversation?.automation_enabled !== false;
  // Enabled for any conversation that supports AI attendance. It used to
  // require a campaign id, which is the same assumption that made the handler
  // return early, so on Instagram and Telegram the button was BOTH disabled
  // and wired to a call that could never fire.
  const canToggleAi =
    !!activeConversation &&
    channelCapabilities.supportsAiHandling(activeConversation.entry_type);

  const conversationHeader = activeConversation ? (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border bg-card px-3 py-2.5 sm:px-4">
      {/* Back button (mobile) */}
      <button
        type="button"
        onClick={handleBack}
        aria-label="Back"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted lg:hidden"
      >
        <CaretLeft weight="bold" className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Avatar. The same rule the inbox and the board follow: the PERSON owns
          the circle, their photo, or their initial, and the channel rides as a
          badge. This header used to show the channel glyph alone, so the one
          place an operator is actually talking to someone was the one place
          that never showed who. */}
      <ChannelAvatar
        name={activeConversation.lead_name || activeConversation.lead_number}
        pictureUrl={currentInboxEntry?.lead_picture}
        entryType={activeConversation.entry_type}
        isGroup={activeConversation.is_group ?? currentInboxEntry?.is_group}
        size="md"
      />

      {/* Info, grows to use free space */}
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
          ) : aiIsActive ? (
            <AttendanceOwnerBadge kind="ai_active" className="shrink-0" />
          ) : (
            <AttendanceOwnerBadge kind="unassigned" className="shrink-0" />
          )}
          {/* Only for channels an agent or workflow can actually attend.
              Instagram DMs are human-attended today, the inbound webhook records
              the message and assigns an operator without invoking AI, so the chip
              would announce automation that never runs. */}
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

      {/* Actions stay compact on the right */}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
        {/* Turn this conversation into a sales deal (linked to the chat). */}
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

        {/* Contact info panel toggle, only in classic mode, where the panel renders */}
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

        {/* AI Toggle - Available for all campaign types */}
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
                  "flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors",
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
                  <div className="text-[11px] font-semibold text-muted-foreground">
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
                      <div className="text-[11px] text-muted-foreground">
                        Encerrada por{" "}
                        <span className="font-medium text-foreground">
                          {currentConversationStatusMeta.provenance.by}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Motivo:{" "}
                        <span className="font-medium text-foreground">
                          {currentConversationStatusMeta.provenance.reasonLabel}
                        </span>
                      </div>
                      {currentConversationStatusMeta.provenance.isSilence ? (
                        <div className="text-[11px] font-medium text-warning-ink">
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

        {/* Assign To dropdown */}
        {can("conversations", "assign") && currentWorkspace?.id && (
          <AssignMemberPicker
            workspaceId={currentWorkspace.id}
            assignedUserId={currentInboxEntry?.assigned_user_id ?? null}
            onlineUserIds={onlineUserIdSet}
            onAssign={handleAssignTo}
          />
        )}

        {/* Call dropdown */}
        <div className="relative" ref={callDropdownRef}>
          {/* Outbound calling (SIP + WhatsApp) and the consent request all flow
            through the dialer, so the whole control is gated on dialer:use.
            Hiding it avoids a button that silently no-ops for members without
            the permission.

            It is also gated on the channel: an Instagram contact has no phone
            number, so offering a call would open a dropdown that can never
            place one. */}
          {can("dialer", "use") &&
            channelCapabilities.supportsCalling(
              activeConversation.entry_type as EntryType,
            ) && (
              <TooltipWrapper content={t.conversation.startCall ?? "Ligar"}>
                <button
                  onClick={() => setCallDropdownOpen((v) => !v)}
                  disabled={isDialerBusy}
                  className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-full transition-all duration-200",
                    isDialerBusy
                      ? "bg-healthy text-healthy-foreground cursor-not-allowed"
                      : "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground",
                  )}
                >
                  <PhoneCall
                    weight={isDialerBusy ? "fill" : "regular"}
                    className="h-4 w-4"
                  />
                </button>
              </TooltipWrapper>
            )}

          {callDropdownOpen && can("dialer", "use") && (
            <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-[--radius] border border-border bg-card shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {/* WhatsApp call. A WhatsApp call is placed FROM one of the
                workspace's connected numbers to the lead. We resolve the
                business phone intelligently, the number this contact
                already talks to us on, and only fall back to a picker when
                it's genuinely ambiguous (several numbers, no prior WA chat). */}
              {(() => {
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
                  // The lead must have granted (and not let expire) WhatsApp call
                  // permission before we can place the call. Until then, keep the
                  // action disabled and steer the operator to "request permission".
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
                        <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
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
                        <span className="ml-auto text-[11px] text-muted-foreground truncate">
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
                      <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
                        Indisponível
                      </span>
                    </button>
                  );
                }

                return (
                  <>
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
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
                          <span className="ml-auto text-[11px] text-muted-foreground truncate">
                            {phone.displayPhoneNumber}
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                );
              })()}

              {/* Request call permission (WhatsApp). The request and the lead's
                reply appear in the conversation thread. Gated on the dedicated
                "call" permission, which the backend route also enforces. */}
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
            : // A rack cut into the panel, not a card floating on it: hairline
              // rule, system radius, no drop shadow. The extra 40px of height comes
              // back from the header bar shrinking 80px -> 48px.
              "h-[calc(100vh-188px)] min-h-[500px] rounded-[--radius] border border-border bg-card",
        )}
      >
        {/*
        THE CONSOLE BAR.

        Was three stacked bands: a toolbar of four bordered control groups, a
        scope breadcrumb repeating what those groups already showed lit, and the
        column header below it. Now one bar of legended banks — the legend does
        the grouping a border used to, so the panel stays continuous and the CRM
        gets a band of height back.
      */}
        <div className="flex shrink-0 flex-col border-b border-border bg-card sm:flex-row sm:items-stretch">
          {/* Below sm the two groups stack: a phone cannot hold both banks of a
            console side by side, and forcing it made the whole page scroll
            sideways by the width the action bank could not give up. */}
          <div className="flex min-w-0 items-stretch overflow-x-auto sm:flex-1">
            {/* Unified Funil selector: switch between atendimento (conversation) and
              vendas (deal) funnels. A funnel only scopes a BOARD, so the selector is
              shown on the Kanban (and the deal board), never on the flat Chat/Tabela
              views, where picking a funnel does nothing (industry-standard: the funnel
              switch lives on the board, not the inbox). */}
            {!hasCampaign &&
              (viewMode === "funnel" || showOpportunityBoard) && (
                <ConsoleBank legend={tBoard("bank.funnel")}>
                  <CrmPipelineSelector
                    value={selectedPipeline}
                    onChange={handleSelectPipeline}
                    disableAllFunnels={groupBy === "stage"}
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
            {canStartConversation && (
              <ConsoleBank legend={tBoard("bank.outbound")}>
                <TooltipWrapper
                  content={tBoard("toolbar.startConversationHint")}
                >
                  {/* Named, not a bare glyph. This is the one control in the row that
                      SENDS something rather than filtering or arranging what is already
                      there, and an icon alone cannot carry that. The label folds away
                      only below sm, where the row wraps anyway. */}
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

        {/* Saved views + filter bar for the workspace-global board AND table (both
          read the same filter). Not shown for the classic inbox, which keeps its
          own chrome untouched. */}
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
              workspaceId={currentWorkspace?.id}
            />
          </>
        )}

        <div className="relative flex flex-1 min-h-0 overflow-hidden">
          {showOpportunityBoard ? (
            /* Same surface, deal object: the selector above flips the board to the
             vendas funnel. OpportunityBoard owns its own filter bar + drawer. */
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
                />
              </div>

              {/* Conversation panel in kanban mode */}
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
                      onEntryStageChange={
                        can("stages", "assign")
                          ? handleEntryStageChange
                          : undefined
                      }
                      onAssignStage={
                        can("stages", "assign") ? handleAssignStage : undefined
                      }
                      onRemoveStage={
                        can("stages", "assign") ? handleRemoveStage : undefined
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
              />
            </div>
          ) : (
            <>
              {/*
              The queue strip.

              Each column in this rack is headed by its own scribble strip, the
              way a bank of channels is legended on the desk. Previously the
              three panes were unlabelled and separated only by a hairline, so
              which region you were in had to be inferred from its contents —
              the layout read as a generic three-pane chat client. Naming the
              strips is what makes it a rack.
            */}
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
                  connectionStatus={status}
                  onLoadMore={handleLoadMoreInbox}
                  hasMore={inboxHasMore}
                  inboxTotalItems={inboxTotalItems}
                  conversationStatusCounts={conversationStatusCounts}
                  loadingMore={loadingInbox}
                  tags={tags}
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

              {/* Conversation Panel */}
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
                {/* Spans the message list AND the composer, so the wallpaper is
                  one surface across the seam between them. The header paints
                  its own bg-card over the top of it. */}
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
                    onEntryStageChange={
                      can("stages", "assign")
                        ? handleEntryStageChange
                        : undefined
                    }
                    onAssignStage={
                      can("stages", "assign") ? handleAssignStage : undefined
                    }
                    onRemoveStage={
                      can("stages", "assign") ? handleRemoveStage : undefined
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

      {/* Mounted unconditionally rather than inside the toolbar branch: the
          dialog owns its own open state, and unmounting it on close would
          discard what the operator typed if the toolbar ever re-renders. */}
      {canStartConversation && (
        <StartConversationDialog
          open={startConversationOpen}
          onOpenChange={setStartConversationOpen}
          onStarted={handleConversationStarted}
        />
      )}

      {/* The draft IS the open state: the dialog exists exactly while there is
          something to schedule, so closing it cannot leave a stale draft behind
          for the next conversation the operator opens. */}
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
    </>
  );
}

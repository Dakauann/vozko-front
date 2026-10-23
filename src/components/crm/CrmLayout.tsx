"use client";

import type {
  AIHandler,
  CampaignType,
  ContainerKind,
  EntryType,
  InboxEntry,
  Stage,
  WhatsAppCampaignTypeFilter,
} from "@/lib/conversations/types";
import { assigneeKind } from "@/lib/conversations/assignee";
import {
  handBackTarget,
  leavesViewerAfterHandBack,
  type HandBackTarget,
} from "@/lib/conversations/hand-back";
import { HandBackConfirmDialog } from "@/components/crm/HandBackConfirmDialog";
import type { FunnelColumnState } from "@/hooks/use-conversation-ws";
import { ArrowSquareOut, Bell, BellSlash, ChatCircleDots, EnvelopeSimple, Info, Robot, WhatsappLogo } from "@/components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";

import type { ComposerControl, ComposerDraft } from "./CrmMessageInput";
import type { InboxControl } from "./CrmInbox";
import { CrmClassicPanels } from "./CrmClassicPanels";
import { CrmCommandCenter } from "./CrmCommandCenter";
import { usePersonalCommands } from "@/hooks/use-personal-commands";
import type { ConversationCommand, ViewCommand } from "./CrmCommandPalette";
import CrmConversationView from "./CrmConversationView";
import ScheduleMessageDialog from "./ScheduleMessageDialog";
import ScheduleTemplateDialog from "./ScheduleTemplateDialog";
import SendTemplateNowDialog from "./SendTemplateNowDialog";
import SendFormDialog from "./SendFormDialog";
import ScheduledMessagesPanel from "./ScheduledMessagesPanel";
import type { ScheduledMessage, SchedulingWindow } from "@/lib/scheduled-messages/types";
import type { TemplateComposerInitial } from "@/hooks/use-template-composer";
import { listScheduledMessagesAction } from "@/app/actions/scheduled-messages";
import CrmWallpaper from "./CrmWallpaper";
import ConversationWindowDeck from "./ConversationWindowDeck";
import CrmInbox from "./CrmInbox";
import { AiHandlerChip } from "./AiHandlerChip";
import { WorkflowRunDrawer } from "./WorkflowRunDrawer";
import CrmFunnelView from "./CrmFunnelView";
import CrmListView from "./CrmListView";
import CrmMessageInput from "./CrmMessageInput";
import { ConversationDropZone } from "./ConversationDropZone";
import { useSendAndFinish } from "@/hooks/use-send-and-finish";
import { focusesComposerOnOpen, type ConversationOpenSource } from "@/lib/conversations/open-source";
import CrmStageFilter from "./CrmStageFilter";
import CrmStageManager from "./CrmStageManager";
import CrmLabelManager from "./CrmLabelManager";
import OpportunityBoard from "./OpportunityBoard";
import CrmPipelineSelector, {
  ALL_FUNNELS_ID,
  type SelectedPipeline,
} from "./CrmPipelineSelector";
import CreateOpportunityButton from "./CreateOpportunityButton";
import { conversationFunnel } from "@/lib/crm/conversation-funnel";
import CrmViewSwitcher from "./CrmViewSwitcher";
import type { CrmViewMode } from "@/lib/crm/view-mode";
import ConsoleBank from "./ConsoleBank";
import CrmSegmentedToggle from "./CrmSegmentedToggle";
import {
  boardEntriesToInboxEntries,
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
  crmBulkAction,
  getCrmBoardAction,
  getCrmEntriesAction,
  listPipelinesAction,
} from "@/app/actions/crm-board";
import { bulkRequest } from "@/lib/crm/bulk-selection";
import { performReversible } from "@/lib/crm/undoable";
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
import { listLeadsQueryAction } from "@/app/actions/leads";
import AssignMemberPicker from "@/components/crm/AssignMemberPicker";
import { WebchatBlockButton } from "@/components/webchat/webchat-block-button";
import { MercadoLivreStartConversation } from "@/components/mercadolivre/mercadolivre-start-conversation";
import { delegateConversationAction, setConversationAutomationAction } from "@/app/actions/conversations";
import type { DelegationTarget } from "@/lib/conversations/delegation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setMessageSoundsMuted, useMessageSoundsMuted } from "@/lib/sounds/message-sound-preference";
import { useCrm } from "@/contexts/crm-context";
import { StartOfficialConversationDialog } from "@/components/whatsapp/start-official-conversation-dialog";
import { EMAIL_ADDRESS_TARGET, StartEmailConversationDialog } from "@/components/email-marketing/start-email-conversation-dialog";
import { useEmailOutreachAvailability } from "@/hooks/use-email-outreach";
import { StartConversationDialog } from "@/components/unofficial-whatsapp/start-conversation-dialog";
import { useWorkspace } from "@/contexts/workspace-context";
import { channelCapabilities } from "@/lib/conversations/types";
import CrmConnectedUsers from "./CrmConnectedUsers";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import ElevatedButton from "../elevated-design/button";
import { useTranslations } from "next-intl";
import CrmConversationInfosPanel from "./CrmConversationInfosPanel";
import ConversationHeader from "./ConversationHeader";
import { ConversationViewers } from "./ConversationViewers";
import ConversationStatusControl from "./ConversationStatusControl";
import ConversationCallControl from "./ConversationCallControl";
import { AttendanceOwnerBadge } from "./ConversationAttendanceSection";
import type { PendingOutcomeRequest } from "@/lib/conversations/types";
import { readConversationDeepLink } from "@/lib/conversations/deep-link";
import { typistsIn } from "@/lib/conversations/typing";
import { windowKey } from "@/lib/conversations/window-deck";
import { useEntryReply } from "@/hooks/use-entry-reply";
import { isEditableTarget } from "@/lib/keyboard/stroke";
import { useConversationUrl } from "@/hooks/use-conversation-url";
import { useInfoPanelPreferences } from "@/hooks/use-info-panel-preferences";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useUnreadTabBadge } from "@/hooks/use-unread-tab-badge";
import { useReconnectNotice } from "@/hooks/use-reconnect-notice";
import { reopensWithTemplate } from "@/lib/conversations/window-reopen";
import { ReconnectingNotice } from "./ReconnectingNotice";
import { CRM_VIEW_MODES, readViewMode, withViewMode } from "@/lib/crm/view-mode";
import { OutcomePickerDialog } from "./OutcomePickerDialog";
import {
  outcomeIsRequired,
  useOutcomeCapture,
} from "@/hooks/use-outcome-capture";

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

const VIEW_LABEL_KEYS: Record<CrmViewMode, string> = {
  classic: "view.chat",
  funnel: "view.kanban",
  table: "view.table",
};

function coerceGroupBy(value: string): CrmGroupBy {
  return value === "stage" ||
    value === "label" ||
    value === "owner" ||
    value === "none"
    ? value
    : "stage";
}

const BOARD_PAGE_SIZE = 20;
const UNSTAGED_COLUMN_ID = "__unstaged__";
const UNASSIGNED_COLUMN_ID = "__unassigned__";

function columnPredicate(
  groupBy: CrmGroupBy,
  columnId: string,
): CrmFilterPredicate | null {
  if (groupBy === "none" || columnId === "__all__") return null;
  if (groupBy === "owner") {
    if (columnId === UNASSIGNED_COLUMN_ID) {
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
  const tWindow = useTranslations("liveChat.conversationWindow");
  const tBoard = useTranslations("crmBoard");
  const tActions = useTranslations("crmActions");
  const tComposer = useTranslations("crmComposer");
  const [mobileShowConversation, setMobileShowConversation] = useState(false);
  const {
    open: infoPanelOpen,
    setOpen: setInfoPanelOpen,
    toggleOpen: toggleInfoPanel,
  } = useInfoPanelPreferences();
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const infoVisible = desktop ? infoPanelOpen : infoSheetOpen;
  const toggleInfo = useCallback(() => {
    if (desktop) toggleInfoPanel();
    else setInfoSheetOpen((open) => !open);
  }, [desktop, toggleInfoPanel]);
  const closeInfo = useCallback(() => {
    if (desktop) setInfoPanelOpen(false);
    else setInfoSheetOpen(false);
  }, [desktop, setInfoPanelOpen]);
  const inboxControlRef = useRef<InboxControl>(null);
  const composerControlRef = useRef<ComposerControl>(null);
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
  const boardFetchRef = useRef({ running: false, again: false });
  const latestRefetchBoardRef = useRef<() => Promise<void>>(async () => {});
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

  const isMuted = useMessageSoundsMuted();
  const toggleNotificationMute = useCallback(() => setMessageSoundsMuted(!isMuted), [isMuted]);

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
    typingByEntry,
    loadHistory,
    loadAround,
    loadNewer,
    returnToPresent,
    prefetchConversation,
    retrySend,
    resendMessage,
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
    totalUnread,
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
    reloadFunnelStages,
    labels,
    reloadStages,
    reloadLabels,
    switchView,
    assignTo,
    forgetEntry,
    setConversationStatus,
    pendingOutcomeRequest,
    clearPendingOutcomeRequest,
    applyLeadPatch,
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
    outbox,
    reopenWindow,
    personalInbox,
  } = useCrm();
  const windowThreadSearch = useMemo(
    () => ({ search: windowSearchMessages, clear: windowClearMessageSearch, loadAround: windowLoadAround }),
    [windowSearchMessages, windowClearMessageSearch, windowLoadAround],
  );
  const windowThreadTransport = useMemo(
    () => ({ outbox, loadNewer: windowLoadNewer, returnToPresent: windowReturnToPresent, retrySend, resend: resendMessage }),
    [outbox, windowLoadNewer, windowReturnToPresent, retrySend, resendMessage],
  );
  const resendInPane = useCallback(
    (messageId: string) => {
      if (activeConversation) resendMessage(activeConversation.entry_id, activeConversation.entry_type, messageId);
    },
    [activeConversation, resendMessage],
  );
  const reconnecting = useReconnectNotice(status);


  const hasCampaign = !!campaignId && !!campaignType;
  const isGlobalBoard = !hasCampaign && viewMode === "funnel";
  const isGlobalTable = !hasCampaign && viewMode === "table";
  const showOpportunityBoard =
    !hasCampaign && selectedPipeline?.objectType === "opportunity";


  const openConversationFunnel = useMemo(() => {
    if (viewMode !== "classic" || !activeConversation) return null;
    const entry = inbox.find((e) => e.entry_id === activeConversation.entry_id);
    return conversationFunnel(funnelStages, entry?.stage?.stage_id);
  }, [viewMode, activeConversation, inbox, funnelStages]);

  const stagePipelineId =
    openConversationFunnel?.pipelineId ??
    (activePipelineId && activePipelineId !== ALL_FUNNELS_ID
      ? activePipelineId
      : undefined);
  const stagePipelineName =
    openConversationFunnel?.pipelineName ?? (stagePipelineId ? selectedPipeline?.name : undefined);

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
      const { pipelines, error } = await listPipelinesAction("conversation");
      if (cancelled || error) return;
      const def = pipelines.find((p) => p.isDefault) ?? pipelines[0];
      if (def) setDefaultConvPipeline({ id: def.id, name: def.name });
      const known = (id: string) =>
        id === ALL_FUNNELS_ID || pipelines.some((p) => p.id === id);
      setActivePipelineId((prev) =>
        prev && known(prev) ? prev : (def?.id ?? ""),
      );
      setSelectedPipeline((prev) =>
        prev && (prev.objectType !== "conversation" || known(prev.id))
          ? prev
          : def
            ? { id: def.id, objectType: "conversation", name: def.name }
            : null,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, hasCampaign]);

  const loadBoard = useCallback(async () => {
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
    return getCrmBoardAction({
      groupBy,
      whatsappCampaignType,
      pipelineId:
        activePipelineId && activePipelineId !== ALL_FUNNELS_ID
          ? activePipelineId
          : undefined,
      filter,
      owners,
      pageSize: BOARD_PAGE_SIZE,
    });
  }, [
    groupBy,
    activePipelineId,
    currentWorkspace?.id,
    filter,
    whatsappCampaignType,
  ]);

  const refetchBoard = useCallback(async () => {
    if (!isGlobalBoard) return;
    const fetching = boardFetchRef.current;
    if (fetching.running) {
      fetching.again = true;
      return;
    }
    fetching.running = true;
    try {
      const { board, error } = await loadBoard();
      if (fetching.again) return;
      if (error) {
        toast.error(error, { id: "crm-board" });
        return;
      }
      setBoardColumns(board?.columns ?? []);
    } finally {
      fetching.running = false;
      if (fetching.again) {
        fetching.again = false;
        void latestRefetchBoardRef.current();
      }
    }
  }, [isGlobalBoard, loadBoard]);

  useEffect(() => {
    latestRefetchBoardRef.current = refetchBoard;
  }, [refetchBoard]);

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
    const mode = readViewMode(window.location.search);
    if (mode) setViewMode(mode);
    const p = params.get("p");
    const pt = params.get("pt");
    if (p && (pt === "conversation" || pt === "opportunity")) {
      setSelectedPipeline({
        id: p,
        objectType: pt,
        name: pt === "opportunity" ? "Oportunidades" : "Atendimento",
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
    const url = `${window.location.pathname}${withViewMode(params.toString(), viewMode)}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [groupBy, activeViewId, filter, hasCampaign, selectedPipeline, viewMode]);

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
        entries: boardEntriesToInboxEntries(colEntries),
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
        whatsappCampaignType,
        page,
        pageSize,
        sortOrder: "desc",
      });
      setGlobalBoardFunnelColumns((prev) => {
        if (!prev?.has(columnId)) return prev;
        const cur = prev.get(columnId)!;
        const incoming = boardEntriesToInboxEntries(result?.entries ?? []);
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
    [filter, groupBy, whatsappCampaignType],
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

  const [composerFocusOnOpen, setComposerFocusOnOpen] = useState(true);
  const handleSelect = useCallback(
    (entryId: string, entryType: EntryType, source?: ConversationOpenSource) => {
      setComposerFocusOnOpen(focusesComposerOnOpen(source));
      subscribe(entryId, entryType);
      setMobileShowConversation(true);
    },
    [subscribe],
  );

  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (!enabled || hasCampaign || status !== "connected" || deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;
    const link = readConversationDeepLink(window.location.search);
    if (link) handleSelect(link.entryId, link.entryType);
  }, [enabled, hasCampaign, status, handleSelect]);

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
  const canStartEmail = useEmailOutreachAvailability().available;
  const [startConversationOpen, setStartConversationOpen] = useState(false);
  const [startOfficialOpen, setStartOfficialOpen] = useState(false);
  const [startEmailOpen, setStartEmailOpen] = useState(false);

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

  useConversationUrl({
    enabled: enabled && !hasCampaign,
    entryId: activeConversation?.entry_id ?? null,
    entryType: activeConversation?.entry_type ?? null,
    onNavigate: (link) => (link ? handleSelect(link.entryId, link.entryType) : handleBack()),
  });

  useUnreadTabBadge(totalUnread, enabled);

  const focusComposer = useCallback(() => composerControlRef.current?.focus(), []);
  const attachDroppedFiles = useCallback((files: File[]) => composerControlRef.current?.attachFiles(files), []);
  const composerAcceptsInput = Boolean(activeConversation?.window_open) && can("conversations", "send");
  const focusComposerAfterDialog = useCallback(() => {
    setTimeout(focusComposer, 0);
  }, [focusComposer]);

  const handlePaneKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Escape" || e.defaultPrevented || isEditableTarget(e.target)) return;
      if (!e.currentTarget.contains(e.target as Node)) return;
      handleBack();
    },
    [handleBack],
  );

  const activeEntryKey = activeConversation
    ? windowKey(activeConversation.entry_id, activeConversation.entry_type)
    : null;
  const [infoSheetEntryKey, setInfoSheetEntryKey] = useState(activeEntryKey);
  if (infoSheetEntryKey !== activeEntryKey) {
    setInfoSheetEntryKey(activeEntryKey);
    setInfoSheetOpen(false);
  }
  const {
    replyTo: replyToMessage,
    reply: setReplyToMessage,
    clearReply,
  } = useEntryReply(activeEntryKey);

  const [scheduleDraft, setScheduleDraft] = useState<ComposerDraft | null>(null);
  const scheduleConfirmRef = useRef<(() => void) | null>(null);
  const requestSchedule = useCallback((draft: ComposerDraft, onScheduled: () => void) => {
    scheduleConfirmRef.current = onScheduled;
    setScheduleDraft(draft);
  }, []);
  const [templateSchedule, setTemplateSchedule] = useState<{
    initial?: TemplateComposerInitial;
  } | null>(null);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [schedulingWindow, setSchedulingWindow] = useState<SchedulingWindow | null>(null);

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
      if (result.error) return;
      setScheduledMessages(result.scheduledMessages);
      setSchedulingWindow(result.window);
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
      clearReply();
      scheduleConfirmRef.current?.();
      scheduleConfirmRef.current = null;
    },
    [clearReply],
  );

  const canScheduleTemplates =
    activeConversation?.entry_type === "whatsapp" &&
    can("conversations", "send") &&
    can("whatsapp_templates", "send");

  const [templateNowOpen, setTemplateNowOpen] = useState(false);
  const canSendTemplateNow =
    Boolean(activeConversation && reopensWithTemplate(activeConversation.entry_type)) && can("conversations", "reopen");
  const openTemplateNow = useCallback(() => setTemplateNowOpen(true), []);

  const [formSendOpen, setFormSendOpen] = useState(false);
  const canSendForm = activeConversation?.entry_type === "whatsapp" && can("whatsapp_forms", "send");
  const openFormSend = useCallback(() => setFormSendOpen(true), []);

  const openTemplateSchedule = useCallback(() => {
    scheduleConfirmRef.current = null;
    setScheduleDraft(null);
    setTemplateSchedule({});
  }, []);

  const handleReuseScheduled = useCallback((message: ScheduledMessage) => {
    scheduleConfirmRef.current = null;
    if (message.template) {
      setTemplateSchedule({
        initial: {
          templateId: message.template.id,
          bodyParams: message.template.bodyParams,
          headerParams: message.template.headerParams,
        },
      });
      return;
    }
    setScheduleDraft({
      text: message.text ?? "",
      mediaId: message.mediaId,
      mediaType: message.mediaType,
      replyToMessageId: message.replyToMessageId,
      signed: message.signed,
    });
  }, []);


  const typingEntryId = activeConversation?.entry_id;
  const typingEntryType = activeConversation?.entry_type;
  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (!typingEntryId || !typingEntryType) return;
      windowSendTyping(typingEntryId, typingEntryType, isTyping);
    },
    [typingEntryId, typingEntryType, windowSendTyping],
  );

  const isRemoteTyping = activeConversation
    ? typistsIn(
        typingByEntry,
        activeConversation.entry_id,
        activeConversation.entry_type,
      ).size > 0
    : false;

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

  const activeLiveRead = useMemo(() => {
    if (!activeConversation) return null;
    const entry = inbox.find((e) => e.entry_id === activeConversation.entry_id);
    return entry?.live_read ?? null;
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

  const moveEntryToStage = useCallback(
    async (entryId: string, entryType: EntryType, stageId: string) => {
      const { error } = await assignStageToEntryAction(stageId, entryId, entryType);
      if (error) {
        toast.error(error);
        return false;
      }
      void refetchBoard();
      return true;
    },
    [refetchBoard],
  );

  const handleEntryStageChange = useCallback(
    (
      entryId: string,
      entryType: EntryType,
      newStageId: string,
      oldStageId: string | null = null,
    ): Promise<boolean> => {
      const apply = () => moveEntryToStage(entryId, entryType, newStageId);
      const restorable = oldStageId && oldStageId !== UNSTAGED_COLUMN_ID && oldStageId !== newStageId;
      if (!restorable) return apply();
      return performReversible(
        {
          apply,
          inverse: () => moveEntryToStage(entryId, entryType, oldStageId),
          labelKey: "stageMoved",
        },
        tActions,
      );
    },
    [moveEntryToStage, tActions],
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
      toast.success(tActions("movedToFunnel"));
      return null;
    },
    [tActions],
  );

  const handleStagesChange = useCallback(() => {
    reloadStages(campaignId || undefined, campaignType, stagePipelineId);
    void reloadFunnelStages();
  }, [reloadStages, reloadFunnelStages, campaignId, campaignType, stagePipelineId]);

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
    ): Promise<boolean> => {
      const assigned = newLabelId
        ? await assignLabelToEntryAction(newLabelId, entryId, entryType)
        : null;
      const removed =
        !assigned?.error && oldLabelId && oldLabelId !== newLabelId
          ? await removeLabelFromEntryAction(oldLabelId, entryId, entryType)
          : null;
      void refetchBoard();
      const error = assigned?.error ?? removed?.error;
      if (error) {
        toast.error(error);
        return false;
      }
      return true;
    },
    [refetchBoard],
  );

  const handleEntryOwnerChange = useCallback(
    async (
      entryId: string,
      entryType: EntryType,
      newOwnerId: string,
    ): Promise<boolean> => {
      if (!newOwnerId || newOwnerId === UNASSIGNED_COLUMN_ID) return false;
      const { result, error } = await crmBulkAction(
        bulkRequest("assign", newOwnerId, { kind: "ids", targets: [{ entryId, entryType }] }),
      );
      void refetchBoard();
      const refusal = result?.failed[0]?.error ?? (result ? null : (error?.message ?? ""));
      if (refusal !== null) {
        toast.error(refusal || tActions("ownerMoveFailed"));
        return false;
      }
      return true;
    },
    [refetchBoard, tActions],
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

  const canViewOthers = can("conversations", "view_others");
  const [handBackRequest, setHandBackRequest] = useState<{
    entryId: string;
    entryType: EntryType;
    target: HandBackTarget;
  } | null>(null);

  const handBackTargetFor = useCallback(
    (entryId: string, entryType: EntryType) => {
      const entry = inbox.find(
        (e) => e.entry_id === entryId && e.entry_type === entryType,
      );
      return entry ? handBackTarget(entry) : null;
    },
    [inbox],
  );

  const settleOwnerChange = useCallback(
    (
      result: { error: string | null; code: string | null; assignedUserId: string | null },
      entryId: string,
      entryType: EntryType,
    ) => {
      if (result.error) {
        const known: Record<string, string> = {
          nothing_to_return_to: tWindow("automationNothingToReturnTo"),
          automation_unusable: tWindow("automationUnusable"),
        };
        toast.error((result.code && known[result.code]) || result.error);
        return;
      }
      if (leavesViewerAfterHandBack(result.assignedUserId ?? "", canViewOthers)) {
        forgetEntry(entryId, entryType);
      }
    },
    [canViewOthers, forgetEntry, tWindow],
  );

  const switchAutomation = useCallback(
    async (entryId: string, entryType: EntryType, enabled: boolean) => {
      settleOwnerChange(await setConversationAutomationAction(entryType, entryId, enabled), entryId, entryType);
    },
    [settleOwnerChange],
  );

  const delegateTo = useCallback(
    async (target: DelegationTarget) => {
      if (!activeConversation) return;
      const entryId = activeConversation.entry_id;
      const entryType = activeConversation.entry_type as EntryType;
      settleOwnerChange(await delegateConversationAction(entryType, entryId, target), entryId, entryType);
    },
    [activeConversation, settleOwnerChange],
  );

  const requestHandBack = useCallback(
    (entryId: string, entryType: EntryType) => {
      const target = handBackTargetFor(entryId, entryType);
      if (target) setHandBackRequest({ entryId, entryType, target });
    },
    [handBackTargetFor],
  );

  const confirmHandBack = useCallback(async () => {
    if (!handBackRequest) return;
    await switchAutomation(handBackRequest.entryId, handBackRequest.entryType, true);
  }, [handBackRequest, switchAutomation]);

  const handleToggleAi = useCallback(async () => {
    if (!activeConversation || togglingAi) return;
    const entryId = activeConversation.entry_id;
    const entryType = activeConversation.entry_type as EntryType;
    const turningOn = activeConversation.automation_enabled === false;
    if (turningOn && handBackTargetFor(entryId, entryType)) {
      requestHandBack(entryId, entryType);
      return;
    }
    setTogglingAi(true);
    try {
      await switchAutomation(entryId, entryType, turningOn);
    } finally {
      setTogglingAi(false);
    }
  }, [activeConversation, togglingAi, handBackTargetFor, requestHandBack, switchAutomation]);



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

  const { capture: outcomeCapture } = useOutcomeCapture(currentWorkspace?.id);
  const [outcomePrompt, setOutcomePrompt] = useState<PendingOutcomeRequest | null>(
    null,
  );

  const requestConversationStatus = useCallback(
    (entryId: string, entryType: string, nextStatus: string) => {
      if (nextStatus === "finished" && outcomeIsRequired(outcomeCapture)) {
        setOutcomePrompt({
          entryId,
          entryType: entryType as PendingOutcomeRequest["entryType"],
          status: "finished",
          message: "",
          outcomes: outcomeCapture?.outcomes ?? [],
        });
        return;
      }
      setConversationStatus(entryId, entryType, nextStatus);
    },
    [outcomeCapture, setConversationStatus],
  );

  const handleConversationStatusChange = useCallback(
    (nextStatus: "ongoing" | "finished") => {
      if (!activeConversation) return;
      requestConversationStatus(
        activeConversation.entry_id,
        activeConversation.entry_type,
        nextStatus,
      );
    },
    [activeConversation, requestConversationStatus],
  );

  const finishAfterSend = useSendAndFinish({
    outbox,
    onFinish: (entryId, entryType) => requestConversationStatus(entryId, entryType, "finished"),
    onAbandon: () => toast.error(tComposer("sendAndFinish.notFinished")),
  });
  const handleSendAndFinish = useCallback(() => {
    if (activeConversation) finishAfterSend(activeConversation.entry_id, activeConversation.entry_type);
  }, [activeConversation, finishAfterSend]);
  const composerFinishes = can("conversations", "send") && currentConversationStatus !== "finished";

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
      const turningOn = current === false;
      if (turningOn && handBackTargetFor(entryId, entryType)) {
        requestHandBack(entryId, entryType);
        return;
      }
      setTogglingWindowAutomation(true);
      try {
        await switchAutomation(entryId, entryType, turningOn);
      } finally {
        setTogglingWindowAutomation(false);
      }
    },
    [togglingWindowAutomation, windowConversations, handBackTargetFor, requestHandBack, switchAutomation],
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
          liveRead: entry?.live_read ?? null,
          currentLabels: entry?.labels ?? [],
          handBack: entry ? handBackTarget(entry) : null,
          businessPhoneId: entry?.business_phone_id ?? "",
        };
      },
      onSendAndFinish: can("conversations", "send") ? finishAfterSend : undefined,
      onReopenWindow: can("conversations", "reopen") ? reopenWindow : undefined,
      onAssign: assignTo,
      onHandBack: requestHandBack,
      onSetStatus: requestConversationStatus,
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
      requestConversationStatus,
      handleWindowToggleAutomation,
      requestHandBack,
      handleEntryStageChange,
      handleAssignStage,
      handleMoveToFunnel,
      handleAssignLabel,
      handleRemoveLabel,
      finishAfterSend,
      reopenWindow,
    ],
  );

  const personalCommands = usePersonalCommands(currentInboxEntry ?? activeConversation, personalInbox);

  const conversationCommands = useMemo<ConversationCommand[]>(() => {
    if (!activeConversation) return [];
    const canSend = can("conversations", "send");
    return [
      ...(canSend && activeConversation.window_open ? [{ id: "conversation.reply" as const, run: focusComposer }] : []),
      ...(canSend && currentInboxEntry && currentConversationStatus !== "finished"
        ? [{ id: "conversation.finish" as const, run: () => handleConversationStatusChange("finished") }]
        : []),
      ...(viewMode !== "funnel" ? [{ id: "conversation.info" as const, run: toggleInfo }] : []),
      { id: "conversation.popOut" as const, run: handlePopOutActive },
      ...personalCommands,
    ];
  }, [
    personalCommands,
    activeConversation,
    can,
    currentInboxEntry,
    currentConversationStatus,
    focusComposer,
    handleConversationStatusChange,
    handlePopOutActive,
    toggleInfo,
    viewMode,
  ]);

  const viewCommands = useMemo<ViewCommand[]>(
    () =>
      showOpportunityBoard
        ? []
        : CRM_VIEW_MODES.filter((mode) => mode !== "table" || !hasCampaign).map((mode) => ({
            mode,
            label: tBoard(VIEW_LABEL_KEYS[mode]),
          })),
    [hasCampaign, showOpportunityBoard, tBoard],
  );

  const openFromPalette = useCallback(
    (entryId: string, entryType: EntryType) => {
      if (viewMode === "table") setViewMode("classic");
      handleSelect(entryId, entryType);
    },
    [handleSelect, viewMode],
  );

  const renderInfoPanel = (presentation: "docked" | "sheet") =>
    activeConversation ? (
      <CrmConversationInfosPanel
        open={presentation === "docked" ? true : infoSheetOpen}
        onClose={closeInfo}
        presentation={presentation}
        conversation={activeConversation}
        inboxEntry={currentInboxEntry}
        conversationStatus={currentConversationStatus}
        canBlock={can("leads", "block")}
        canManageMemories={can("leads", "update")}
        canRenameLead={can("leads", "update")}
        canReadLead={can("leads", "read")}
        workspaceId={currentWorkspace?.id}
        onLeadPatched={applyLeadPatch}
        onOpenConversation={handleSelect}
      />
    ) : null;

  const renderConversationHeader = (inPane: boolean) =>
    activeConversation ? (
      <ConversationHeader
        name={activeConversation.lead_name || activeConversation.lead_number}
        number={activeConversation.lead_number}
        pictureUrl={currentInboxEntry?.lead_picture}
        entryType={activeConversation.entry_type}
        isGroup={activeConversation.is_group ?? currentInboxEntry?.is_group}
        onBack={handleBack}
        onClose={inPane ? handleBack : undefined}
        badges={
          <>
            <ConversationViewers entryId={activeConversation.entry_id} entryType={activeConversation.entry_type} />
            {currentInboxEntry?.assigned_user_id ||
            currentInboxEntry?.assigned_username ? (
              <AttendanceOwnerBadge
                kind={assigneeKind(currentInboxEntry.assigned_user_id) ?? "human"}
                className="shrink-0"
              />
            ) : aiIsActive && hasAiHandler ? (
              <AttendanceOwnerBadge kind="ai_active" className="shrink-0" />
            ) : (
              <AttendanceOwnerBadge kind="unassigned" className="shrink-0" />
            )}
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
          </>
        }
        status={
          currentInboxEntry ? (
            <ConversationStatusControl
              status={currentConversationStatus}
              closeSource={currentCloseSource}
              closeReason={currentCloseReason}
              canChange={can("conversations", "send")}
              onChange={handleConversationStatusChange}
            />
          ) : null
        }
        actions={
          <>
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

            {viewMode !== "funnel" && (
              <TooltipWrapper content={tContactPanel("toggleTooltip")}>
                <button
                  type="button"
                  onClick={toggleInfo}
                  aria-pressed={infoVisible}
                  aria-label={tContactPanel("toggleTooltip")}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                    infoVisible
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Info
                    weight={infoVisible ? "fill" : "regular"}
                    className="h-4 w-4"
                  />
                </button>
              </TooltipWrapper>
            )}

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

            {(can("conversations", "assign") || can("conversations", "delegate")) && currentWorkspace?.id && (
              <AssignMemberPicker
                workspaceId={currentWorkspace.id}
                assignedUserId={currentInboxEntry?.assigned_user_id ?? null}
                onlineUserIds={onlineUserIdSet}
                onAssign={handleAssignTo}
                canAssignMembers={can("conversations", "assign")}
                onDelegate={can("conversations", "delegate") ? delegateTo : undefined}
                handBack={currentInboxEntry ? handBackTarget(currentInboxEntry) : null}
                onHandBack={() =>
                  requestHandBack(
                    activeConversation.entry_id,
                    activeConversation.entry_type as EntryType,
                  )
                }
              />
            )}

            {activeConversation.entry_type === "webchat" &&
              can("conversations", "update") && (
                <WebchatBlockButton
                  entryId={activeConversation.entry_id}
                  blocked={activeConversation.window_closed_reason === "contact_blocked"}
                />
              )}

            <MercadoLivreStartConversation
              entryId={activeConversation.entry_id}
              entryType={activeConversation.entry_type as EntryType}
              canSend={can("conversations", "send")}
            />

            <ConversationCallControl
              entryId={activeConversation.entry_id}
              entryType={activeConversation.entry_type}
              leadNumber={activeConversation.lead_number}
              messages={activeConversation.messages}
              inbox={inbox}
              translations={t.conversation}
            />
          </>
        }
      />
    ) : null;

  return (
    <MotionConfig reducedMotion="user">
      <ReconnectingNotice visible={reconnecting} />
      <CrmCommandCenter
        enabled={enabled}
        recent={filteredInbox}
        searchResults={searchResults}
        searching={searching}
        onSearch={searchInbox}
        onEndSearch={() => (inboxControlRef.current ? inboxControlRef.current.resumeSearch() : clearSearch())}
        onOpenConversation={openFromPalette}
        commands={conversationCommands}
        views={viewCommands}
        currentView={viewMode}
        onSwitchView={setViewMode}
        onFocusSearch={
          viewMode === "classic" && !showOpportunityBoard
            ? () => inboxControlRef.current?.focusSearch()
            : undefined
        }
      />
      <OutcomePickerDialog
        request={outcomePrompt ?? pendingOutcomeRequest}
        onConfirm={(entryId, entryType, status, outcomeCode) => {
          setOutcomePrompt(null);
          clearPendingOutcomeRequest();
          setConversationStatus(entryId, entryType, status, outcomeCode);
        }}
        onCancel={() => {
          setOutcomePrompt(null);
          clearPendingOutcomeRequest();
        }}
      />
      <HandBackConfirmDialog
        open={handBackRequest !== null}
        onOpenChange={(open) => {
          if (!open) setHandBackRequest(null);
        }}
        target={handBackRequest?.target ?? null}
        canViewOthers={canViewOthers}
        onConfirm={confirmHandBack}
      />
      <div
        className={cn(
          "flex flex-col overflow-hidden",
          embedded
            ? "h-full bg-card"
            :
              "h-[calc(100vh-188px)] min-h-[500px] rounded-[--radius] border border-border bg-card",
        )}
      >
        <div className="flex shrink-0 flex-col border-b border-border bg-card sm:flex-row sm:items-stretch">
          <div className="flex min-w-0 items-stretch overflow-x-auto sm:flex-1">
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
            {(canStartConversation || canStartOfficial || canStartEmail) && (
              <ConsoleBank legend={tBoard("bank.outbound")}>
                {canStartOfficial && (
                  <TooltipWrapper content={tBoard("toolbar.startOfficialHint")}>
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
                {canStartEmail && (
                  <TooltipWrapper content={tBoard("toolbar.startEmailHint")}>
                    <ElevatedButton
                      variant="outline-subtle"
                      size="sm"
                      onClick={() => setStartEmailOpen(true)}
                      title={tBoard("toolbar.startEmail")}
                      titleClassName="hidden sm:inline"
                      icon={<EnvelopeSimple size={16} weight="bold" />}
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
                    pipelineName={stagePipelineName}
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
                    !can("stages", "update")
                      ? undefined
                      : isGlobalBoard
                        ? groupBy === "stage"
                          ? handleGlobalBoardReorder
                          : undefined
                        : handleStagesChange
                  }
                  onEntryStageChange={
                    isGlobalBoard
                      ? groupBy === "stage" && can("stages", "assign")
                        ? moveEntryToStage
                        : groupBy === "label" && can("labels", "assign")
                          ? handleEntryLabelChange
                          : groupBy === "owner" &&
                              can("conversations", "assign")
                            ? handleEntryOwnerChange
                            : undefined
                      : can("stages", "assign")
                        ? moveEntryToStage
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

              {activeConversation && (
                <div
                  onKeyDown={handlePaneKeyDown}
                  className="relative isolate w-[420px] flex-shrink-0 border-l border-border flex flex-col"
                >
                  <CrmWallpaper />
                  {renderConversationHeader(true)}
                  <ConversationDropZone enabled={composerAcceptsInput} onFiles={attachDroppedFiles} className="flex min-h-0 flex-1 flex-col">
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
                      onLoadNewer={loadNewer}
                      onReturnToPresent={returnToPresent}
                      outbox={outbox}
                      onRetrySend={retrySend}
                      onResendMessage={resendInPane}
                      onReply={setReplyToMessage}
                      tags={tags}
                      currentEntryTags={currentEntryStages}
                      entryAvailableTags={entryAvailableStages}
                      liveRead={activeLiveRead}
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
                    canManageTemplates={canScheduleTemplates}
                    onChanged={refreshScheduledMessages}
                    onReuse={handleReuseScheduled}
                  />
                  <CrmMessageInput
                    entryType={activeConversation.entry_type}
                    entryId={activeConversation.entry_id}
                    onSend={sendMessage}
                    onSendMedia={sendMediaMessage}
                    onSendButton={sendButtonMessage}
                    onSendAndFinish={composerFinishes ? handleSendAndFinish : undefined}
                    onTyping={handleTyping}
                    onSchedule={
                      can("conversations", "send") ? requestSchedule : undefined
                    }
                    onScheduleTemplate={
                      canScheduleTemplates ? openTemplateSchedule : undefined
                    }
                    onSendTemplateNow={canSendTemplateNow ? openTemplateNow : undefined}
                    onSendForm={canSendForm ? openFormSend : undefined}
                    windowOpen={activeConversation.window_open}
                    windowExpiresAt={activeConversation.window_expires_at}
                    windowClosedReason={activeConversation.window_closed_reason}
                    windowClosedDetail={activeConversation.window_closed_detail}
                    windowTier={activeConversation.window_tier}
                    translations={t.input}
                    replyToMessage={replyToMessage}
                    onClearReply={clearReply}
                    controlRef={composerControlRef}
                    focusOnOpen={composerFocusOnOpen}
                    disabled={!can("conversations", "send")}
                    disabledReason={
                      !can("conversations", "send")
                        ? (t.input.noPermissionSend ??
                          "You don't have permission to send messages")
                        : undefined
                    }
                  />
                  </ConversationDropZone>
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
            <CrmClassicPanels
              desktop={desktop}
              showConversation={mobileShowConversation}
              info={desktop && infoPanelOpen ? renderInfoPanel("docked") : null}
              inbox={
                <CrmInbox
                  controlRef={inboxControlRef}
                  personalInbox={personalInbox}
                  onReplyToOpen={composerAcceptsInput ? focusComposer : undefined}
                  entries={filteredInbox}
                  selectedEntryId={activeConversation?.entry_id ?? null}
                  onSelect={handleSelect}
                  onOpenInWindow={handleOpenInWindow}
                  openInWindowLabel={tWindow("openInWindow")}
                  connectionStatus={status}
                  onPrefetchConversation={prefetchConversation}
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
                  onAssignTo={can("conversations", "assign") ? assignTo : undefined}
                  onlineUserIds={onlineUserIdSet}
                  onEntryStageChange={
                    can("stages", "assign") ? handleEntryStageChange : undefined
                  }
                  noPermissionStageAssign={
                    t.conversation.noPermissionStageAssign
                  }
                />
              }
              conversation={
                <>
                <CrmWallpaper />
                {renderConversationHeader(false)}

                <ConversationDropZone enabled={composerAcceptsInput} onFiles={attachDroppedFiles} className="flex min-h-0 flex-1 flex-col">
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
                    onLoadNewer={loadNewer}
                    onReturnToPresent={returnToPresent}
                    outbox={outbox}
                    onRetrySend={retrySend}
                    onResendMessage={resendInPane}
                    onReply={setReplyToMessage}
                    tags={tags}
                    currentEntryTags={currentEntryStages}
                    entryAvailableTags={entryAvailableStages}
                    liveRead={activeLiveRead}
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
                    canManageTemplates={canScheduleTemplates}
                    onChanged={refreshScheduledMessages}
                    onReuse={handleReuseScheduled}
                  />
                  <CrmMessageInput
                    entryType={activeConversation.entry_type}
                    entryId={activeConversation.entry_id}
                    onSend={sendMessage}
                    onSendMedia={sendMediaMessage}
                    onSendButton={sendButtonMessage}
                    onSendAndFinish={composerFinishes ? handleSendAndFinish : undefined}
                    onTyping={handleTyping}
                    onSchedule={
                      can("conversations", "send") ? requestSchedule : undefined
                    }
                    onScheduleTemplate={
                      canScheduleTemplates ? openTemplateSchedule : undefined
                    }
                    onSendTemplateNow={canSendTemplateNow ? openTemplateNow : undefined}
                    onSendForm={canSendForm ? openFormSend : undefined}
                    windowOpen={activeConversation.window_open}
                    windowExpiresAt={activeConversation.window_expires_at}
                    windowClosedReason={activeConversation.window_closed_reason}
                    windowClosedDetail={activeConversation.window_closed_detail}
                    windowTier={activeConversation.window_tier}
                    translations={t.input}
                    replyToMessage={replyToMessage}
                    onClearReply={clearReply}
                    controlRef={composerControlRef}
                    focusOnOpen={composerFocusOnOpen}
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
                </ConversationDropZone>
                </>
              }
            />
          )}
          {!desktop && renderInfoPanel("sheet")}
          <WorkflowRunDrawer
            handler={workflowDrawerHandler}
            open={!!workflowDrawerHandler}
            onOpenChange={(open) => {
              if (!open) setWorkflowDrawerHandler(null);
            }}
          />
        </div>
      </div>

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

      {canStartEmail && (
        <StartEmailConversationDialog
          open={startEmailOpen}
          onOpenChange={setStartEmailOpen}
          target={EMAIL_ADDRESS_TARGET}
          onStarted={handleConversationStarted}
        />
      )}

      {scheduleDraft && scheduleEntryType && scheduleEntryId && (
        <ScheduleMessageDialog
          open
          onOpenChange={(open) => {
            if (open) return;
            scheduleConfirmRef.current = null;
            setScheduleDraft(null);
            focusComposerAfterDialog();
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
          onUseTemplate={canScheduleTemplates ? openTemplateSchedule : undefined}
        />
      )}

      {templateSchedule && scheduleEntryType && scheduleEntryId && (
        <ScheduleTemplateDialog
          open
          onOpenChange={(open) => {
            if (open) return;
            setTemplateSchedule(null);
            focusComposerAfterDialog();
          }}
          entryType={scheduleEntryType}
          entryId={scheduleEntryId}
          businessPhoneId={
            inbox.find((e) => e.entry_id === scheduleEntryId)?.business_phone_id ?? ""
          }
          recipientName={activeConversation?.lead_name}
          window={schedulingWindow}
          initial={templateSchedule.initial}
          onScheduled={handleScheduled}
        />
      )}

      {templateNowOpen && activeConversation && (
        <SendTemplateNowDialog
          open
          onOpenChange={(open) => {
            if (open) return;
            setTemplateNowOpen(false);
            focusComposerAfterDialog();
          }}
          businessPhoneId={
            inbox.find((e) => e.entry_id === activeConversation.entry_id)?.business_phone_id ?? ""
          }
          recipientName={activeConversation.lead_name}
          onSend={(templateId, parameters, headerParameters) =>
            reopenWindow(activeConversation.entry_id, activeConversation.entry_type, templateId, parameters, headerParameters)
          }
        />
      )}

      {formSendOpen && canSendForm && activeConversation && (
        <SendFormDialog
          open
          onOpenChange={(open) => {
            if (open) return;
            setFormSendOpen(false);
            focusComposerAfterDialog();
          }}
          entryId={activeConversation.entry_id}
          businessPhoneId={
            inbox.find((e) => e.entry_id === activeConversation.entry_id)?.business_phone_id ?? ""
          }
          recipientName={activeConversation.lead_name}
          onUseTemplate={canSendTemplateNow ? openTemplateNow : canScheduleTemplates ? openTemplateSchedule : undefined}
        />
      )}

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
          popOut: tWindow("popOut"),
          returnToPage: tWindow("returnToPage"),
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
        threadSearch={windowThreadSearch}
        transport={windowThreadTransport}
        onSend={windowSendMessage}
        onSendMedia={windowSendMedia}
        onSendButton={windowSendButton}
        onTyping={windowSendTyping}
      />
    </MotionConfig>
  );
}

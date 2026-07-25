"use client";

import type {
  ActiveConversation,
  CampaignType,
  ConnectedUser,
  ConnectionStatus,
  ConversationMessage,
  EntryType,
  InboxEntry,
  Label,
  MediaType,
  Stage,
  ViewMode,
  WhatsAppCampaignTypeFilter,
  WsAnalysisUpdatePayload,
  WsSearchInboxPayload,
} from "@/lib/conversations/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  type FunnelColumnState,
  type SendButtonWsInput,
  useConversationWs,
} from "@/hooks/use-conversation-ws";
import { listStagesAction } from "@/app/actions/stages";
import { listLabelsAction } from "@/app/actions/labels";
import { useWorkspace } from "@/contexts/workspace-context";


interface CrmContextValue {
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
  tags: Stage[];
  reloadStages: (campaignId?: string, campaignType?: string) => Promise<void>;
  labels: Label[];
  reloadLabels: () => Promise<void>;
  campaignId: string;
  campaignType?: CampaignType;
  viewMode: ViewMode;
  switchView: (
    campaignId?: string,
    campaignType?: CampaignType,
    whatsappCampaignType?: WhatsAppCampaignTypeFilter,
    conversationStatus?: string,
  ) => void;
  latestAnalysisUpdate: WsAnalysisUpdatePayload | null;
  assignTo: (entryId: string, entryType: string, userId: string) => void;
  setConversationStatus: (
    entryId: string,
    entryType: string,
    status: string,
  ) => void;
}

const CrmContext = createContext<CrmContextValue | null>(null);


interface CrmProviderProps {
  children: ReactNode;
  token: string;
  campaignId?: string;
  campaignType?: CampaignType;
  enabled?: boolean;
}

export function CrmProvider({
  children,
  token,
  campaignId = "",
  campaignType,
  enabled = true,
}: CrmProviderProps) {
  const [tags, setTags] = useState<Stage[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";

  const ws = useConversationWs({
    token,
    ...(campaignId ? { campaignId } : {}),
    ...(campaignType ? { campaignType } : {}),
    enabled,
  });


  const reloadStages = useCallback(
    // Stages are workspace-global now (the /stages endpoint ignores the campaign
    // args after the stage-promotion migration), so we always load them. The
    // campaign args are kept as an optional scope, not a hard gate.
    async (cId?: string, cType?: string) => {
      const result = await listStagesAction(
        workspaceId || undefined,
        cId,
        cType,
      );
      if (!result.error) {
        setTags(result.stages);
      }
    },
    [workspaceId],
  );

  const reloadLabels = useCallback(async () => {
    const result = await listLabelsAction(workspaceId || undefined);
    if (!result.error) {
      setLabels(result.labels);
    }
  }, [workspaceId]);

  const value = useMemo<CrmContextValue>(
    () => ({
      ...ws,
      tags,
      reloadStages,
      labels,
      reloadLabels,
      campaignId,
      campaignType,
      viewMode: ws.viewMode,
      switchView: ws.switchView,
    }),
    [ws, tags, reloadStages, labels, reloadLabels, campaignId, campaignType],
  );

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}


export function useCrm(): CrmContextValue {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error("useCrm must be used within a CrmProvider");
  }
  return context;
}

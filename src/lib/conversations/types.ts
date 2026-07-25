import type { Analysis } from '@/lib/analysis/types';


export interface Stage {
    id: string;
    userId: string;
    name: string;
    description: string;
    color: string;
    isDefault: boolean;
    isInitial: boolean;
    position: number;
    createdAt: string;
    updatedAt: string;
}

export interface EntryStage {
    id: string;
    stageId: string;
    entryId: string;
    entryType: EntryType;
    userId: string;
    stageName: string;
    stageColor: string;
    createdAt: string;
}

export interface InboxEntryStage {
    stage_id: string;
    name: string;
    color: string;
}


export interface Label {
    id: string;
    userId: string;
    name: string;
    color: string;
    position: number;
    createdAt: string;
    updatedAt: string;
}

export interface EntryLabel {
    id: string;
    labelId: string;
    entryId: string;
    entryType: EntryType;
    userId: string;
    labelName: string;
    labelColor: string;
    createdAt: string;
}

export interface InboxEntryLabel {
    label_id: string;
    name: string;
    color: string;
}


export type EntryType = 'voice' | 'whatsapp' | 'sip' | 'support';

export type CampaignType = 'voice' | 'whatsapp' | 'support';

export type WhatsAppCampaignTypeFilter = 'standard' | 'organic';

export function normalizeEntryType(entryType: EntryType): 'voice' | 'whatsapp' | 'support' {
    if (entryType === 'sip') return 'voice';
    return entryType as 'voice' | 'whatsapp' | 'support';
}

export type MessageType =
    | 'user_message'
    | 'ai_response'
    | 'operator'
    | 'tool_call'
    | 'tool_result'
    | 'audio'
    | 'system'
    | 'template'
    | 'call_permission_request'
    | 'call_permission_granted'
    | 'call_permission_rejected'
    | 'call_received'
    | 'call_answered'
    | 'call_missed'
    | 'call_ended';

export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';


export interface MatchedMessage {
    message_id: string;
    text: string;
    from: string;
    message_type: MessageType;
    channel: 'voice' | 'whatsapp';
    created_at: string;
    position: number;
    page: number;
}

/**
 * AIHandler names the AI attending a conversation. `kind` is the effective handler
 * configured on the campaign; a running workflow also carries its live run + current
 * node. Whether the AI is paused for this conversation is the entry's
 * `automation_enabled` flag, not repeated here.
 */
export interface AIHandler {
    kind: "agent" | "workflow";
    agent_id?: string;
    agent_name?: string;
    agent_avatar?: string;
    agent_active?: boolean;
    workflow_id?: string;
    workflow_name?: string;
    workflow_run_id?: string;
    run_status?: string;
    current_node_id?: string;
    current_node_type?: string;
}

export interface InboxEntry {
    entry_id: string;
    entry_type: EntryType;
    lead_id?: string;
    lead_name: string;
    lead_number: string;
    blocked?: boolean;
    entry_variables?: string[];
    unread_count: number;
    last_message_preview: string;
    last_message_at: string;
    last_message_type: MessageType;
    last_message_sender: string;
    last_message_sender_avatar: string;
    window_open: boolean;
    window_expires_at: string | null;
    business_phone_id: string;
    stage?: InboxEntryStage | null;
    available_stages?: InboxEntryStage[];
    labels?: InboxEntryLabel[];
    automation_enabled?: boolean | null;
    matched_messages?: MatchedMessage[];
    total_matches?: number;
    campaign_id?: string;
    campaign_name?: string;
    assigned_user_id?: string;
    assigned_username?: string;
    latest_analysis?: Analysis | null;
    conversation_status?: string;
    close_source?: string;
    close_reason?: string;
    closed_at?: string | null;
    ai_handler?: AIHandler | null;
}


export interface TemplateMetadataButton {
    type: string;
    text: string;
    url?: string;
    phoneNumber?: string;
}

export interface TemplateMetadataComponent {
    type: string;
    format?: string;
    text?: string;
    buttons?: TemplateMetadataButton[];
}

export interface TemplateMessageMetadata {
    template_name: string;
    language: string;
    category: string;
    components: TemplateMetadataComponent[];
    header_media_url?: string;
}

export interface EntryTemplateInfo {
    template_name: string;
    language: string;
    category: string;
    body_text: string;
    components: TemplateMetadataComponent[];
    header_media_url?: string;
}

export interface EntryMetadata {
    template_info?: EntryTemplateInfo;
    [key: string]: unknown;
}

export interface ConversationMessage {
    id: string;
    entry_id: string;
    entry_type: EntryType;
    channel: 'voice' | 'whatsapp';
    message_type: MessageType;
    from: string;
    to: string;
    text: string;
    media_id?: string;
    media_type?: MediaType;
    media_url?: string;
    sender_name: string;
    sender_avatar?: string;
    read: boolean;
    read_at: string | null;
    read_by: string | null;
    delivery_status?: 'sent' | 'delivered' | 'read' | 'failed';
    reply_to_message_id?: string;
    metadata?: TemplateMessageMetadata;
    created_at: string;
    updated_at: string;
}


export interface ConversationMedia {
    media_id: string;
    media_type: MediaType;
    url: string;
    filename: string;
}


export interface WsSubscribePayload {
    entry_id: string;
    entry_type: EntryType;
    page_size?: number;
}

export interface WsUnsubscribePayload {
    entry_id: string;
    entry_type: EntryType;
}

export interface WsSendPayload {
    entry_id: string;
    entry_type: EntryType;
    text: string;
    media_id?: string;
    media_type?: MediaType;
}

export interface WsMarkReadPayload {
    entry_id: string;
    entry_type: EntryType;
    message_ids: string[];
}

export interface WsTypingPayload {
    entry_id: string;
    entry_type: EntryType;
    is_typing: boolean;
}

export interface WsLoadHistoryPayload {
    entry_id: string;
    entry_type: EntryType;
    before: string;
    page_size?: number;
}

export interface WsRequestInboxPagePayload {
    page: number;
    page_size?: number;
}

export interface WsSearchInboxPayload {
    query?: string;
    stage_id?: string;
    stage_name?: string;
    min_message_count?: number;
    max_message_count?: number;
    message_search?: string;
    channel?: 'voice' | 'whatsapp';
    date_from?: string;
    date_to?: string;
    window_open?: boolean;
    has_unread?: boolean;
    conversation_status?: 'new' | 'ongoing' | 'finished';
    responsible_user_id?: string;
    responsible_unassigned?: boolean;
    page?: number;
    page_size?: number;
}

export interface WsSearchMessagesPayload {
    entry_id: string;
    entry_type: EntryType;
    query: string;
    page?: number;
    page_size?: number;
}


export interface WsStartCallPayload {
    entry_id: string;
    entry_type: EntryType;
    sip_trunk_id?: string;
    request_id?: string;
}

export interface WsCallAudioPayload {
    audio: string; 
    sample_rate?: number;
}

export interface WsEndCallPayload {
    request_id?: string;
}

export type WsClientEvent =
    | { type: 'subscribe'; payload: WsSubscribePayload }
    | { type: 'unsubscribe'; payload: WsUnsubscribePayload }
    | { type: 'send'; payload: WsSendPayload }
    | { type: 'mark_read'; payload: WsMarkReadPayload }
    | { type: 'typing'; payload: WsTypingPayload }
    | { type: 'load_history'; payload: WsLoadHistoryPayload }
    | { type: 'request_inbox_page'; payload: WsRequestInboxPagePayload }
    | { type: 'search_inbox'; payload: WsSearchInboxPayload }
    | { type: 'search_messages'; payload: WsSearchMessagesPayload }
    | { type: 'start_call'; payload: WsStartCallPayload }
    | { type: 'call_audio'; payload: WsCallAudioPayload }
    | { type: 'end_call'; payload: WsEndCallPayload }
    | { type: 'switch_view'; payload: WsSwitchViewPayload };

export interface WsSwitchViewPayload {
    campaign_id?: string;
    campaign_type?: CampaignType;
    whatsapp_campaign_type?: WhatsAppCampaignTypeFilter;
    conversation_status?: 'new' | 'ongoing' | 'finished';
}

export type ViewMode = 'campaign' | 'global';

export interface WsViewSwitchedPayload {
    campaign_id: string;
    campaign_type: string;
    view_mode: ViewMode;
    whatsapp_campaign_type?: WhatsAppCampaignTypeFilter;
    conversation_status?: 'new' | 'ongoing' | 'finished';
}


export interface WsInboxPayload {
    entries: InboxEntry[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    stage_counts?: Record<string, number>;
    conversation_status_counts?: Record<string, number>;
}

export interface WsEntryUpdatePayload {
    entry: InboxEntry;
}

export interface WsSubscribedPayload {
    entry_id: string;
    entry_type: EntryType;
    lead_name: string;
    lead_number: string;
    lead_metadata?: EntryMetadata;
    unread_count: number;
    window_open?: boolean;
    window_expires_at?: string | null;
}

export interface WsHistoryPayload {
    entry_id: string;
    entry_type: EntryType;
    messages: ConversationMessage[];
    has_more: boolean;
    total?: number;
    page_size: number;
}

export interface WsMessagePayload {
    entry_id: string;
    entry_type: EntryType;
    message: ConversationMessage;
}

export interface WsMessageSentPayload {
    entry_id: string;
    entry_type: EntryType;
    message: ConversationMessage;
}

export interface WsMessageErrorPayload {
    entry_id: string;
    entry_type: EntryType;
    error: string;
}

export interface WsReadPayload {
    entry_id: string;
    entry_type: EntryType;
    message_ids: string[];
    read_by: string;
    read_at: string;
}

export interface WsMessageStatusPayload {
    entry_id: string;
    entry_type: EntryType;
    message_id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
}

export interface WsTypingServerPayload {
    entry_id: string;
    entry_type: EntryType;
    user_id: string;
    is_typing: boolean;
}

export interface WsUnsubscribedPayload {
    entry_id: string;
    entry_type: EntryType;
}

export interface WsErrorPayload {
    code: string;
    message: string;
    entry_id?: string;
    entry_type?: EntryType;
    status?: 'new' | 'ongoing' | 'finished';
    previous_status?: 'new' | 'ongoing' | 'finished';
}

export interface WsStageUpdatePayload {
    entry_id: string;
    entry_type: EntryType;
    stage: InboxEntryStage | null;
}

export interface WsLabelUpdatePayload {
    entry_id: string;
    entry_type: EntryType;
    labels: InboxEntryLabel[];
}

export interface WsSearchResultsPayload {
    query?: string;
    filters: Record<string, unknown>;
    entries: InboxEntry[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
}

export interface WsSearchMessagesResultsPayload {
    entry_id: string;
    entry_type: EntryType;
    query: string;
    messages: ConversationMessage[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
}


export type CallStatus = 'ringing' | 'answered' | 'ended' | 'waiting_slot';


export interface WsFunnelColumnPayload {
    stage_id: string;
    entries: InboxEntry[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
}

export interface WsFunnelColumnSummary {
    stage_id: string;
    total_items: number;
}

export interface WsFunnelSummaryPayload {
    columns: WsFunnelColumnSummary[];
}


export type CallEndReason = 'ended' | 'failed' | 'busy' | 'no_answer' | 'declined';

export type CallErrorCode =
    | 'already_in_call'
    | 'no_phone'
    | 'not_configured'
    | 'dial_failed'
    | 'resolve_failed'
    | 'unauthorized'
    | 'no_active_call';

export interface WsCallStatusPayload {
    status: CallStatus;
    call_id?: string;
    entry_id: string;
    entry_type: EntryType;
    phone_number?: string;
    request_id?: string;
    error_code?: CallErrorCode;
    error_message?: string;
}

export interface WSCallWaitingSlotPayload {
    entry_id: string;
    entry_type: EntryType;
    reason: string;
}

export interface WsCallAudioOutPayload {
    audio: string; 
    sample_rate: number;
}

export interface WsCallEndedPayload {
    call_id?: string;
    entry_id: string;
    entry_type: EntryType;
    reason: CallEndReason;
    duration_seconds?: number;
    request_id?: string;
}

export interface WsEntryRemovedPayload {
    entry_id: string;
    entry_type: EntryType;
    reason?: string;
}

export interface WsConversationStatusUpdatePayload {
    entry_id: string;
    entry_type: EntryType;
    status: string;
    close_source?: string;
    close_reason?: string;
    closed_at?: string | null;
}

export interface WsConversationStatusCountsUpdatePayload {
    counts: Record<string, number>;
}


export interface WSConnectedUsersPayload {
    users: ConnectedUser[]
}

export type WsServerEvent =
    | { type: 'conversation:inbox'; payload: WsInboxPayload }
    | { type: 'conversation:connected_users'; payload: WSConnectedUsersPayload }
    | { type: 'conversation:entry_update'; payload: WsEntryUpdatePayload }
    | { type: 'conversation:subscribed'; payload: WsSubscribedPayload }
    | { type: 'conversation:history'; payload: WsHistoryPayload }
    | { type: 'conversation:message'; payload: WsMessagePayload }
    | { type: 'conversation:message_sent'; payload: WsMessageSentPayload }
    | { type: 'conversation:message_error'; payload: WsMessageErrorPayload }
    | { type: 'conversation:read'; payload: WsReadPayload }
    | { type: 'conversation:message_status'; payload: WsMessageStatusPayload }
    | { type: 'conversation:typing'; payload: WsTypingServerPayload }
    | { type: 'conversation:unsubscribed'; payload: WsUnsubscribedPayload }
    | { type: 'conversation:stage_update'; payload: WsStageUpdatePayload }
    | { type: 'conversation:label_update'; payload: WsLabelUpdatePayload }
    | { type: 'conversation:search_results'; payload: WsSearchResultsPayload }
    | { type: 'conversation:search_messages_results'; payload: WsSearchMessagesResultsPayload }
    | { type: 'conversation:funnel_column'; payload: WsFunnelColumnPayload }
    | { type: 'conversation:funnel_summary'; payload: WsFunnelSummaryPayload }
    | { type: 'call:status'; payload: WsCallStatusPayload }
    | { type: 'call:waiting_slot'; payload: WSCallWaitingSlotPayload }
    | { type: 'call:audio'; payload: WsCallAudioOutPayload }
    | { type: 'call:ended'; payload: WsCallEndedPayload }
    | { type: 'conversation:entry_removed'; payload: WsEntryRemovedPayload }
    | { type: 'conversation:conversation_status_update'; payload: WsConversationStatusUpdatePayload }
    | { type: 'conversation:conversation_status_counts_update'; payload: WsConversationStatusCountsUpdatePayload }
    | { type: 'conversation:view_switched'; payload: WsViewSwitchedPayload }
    | { type: 'conversation:analysis_update'; payload: WsAnalysisUpdatePayload }
    | { type: 'conversation:error'; payload: WsErrorPayload };


export interface WsAnalysisUpdatePayload {
    entry_id: string;
    entry_type: EntryType;
    analysis: Analysis;
}


export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type ConnectedUser = {
    user_id: string;
    workspace_id: string;
    campaign_id?: string;
    campaign_type?: CampaignType;
    campaign_name?: string;
    view_mode: ViewMode;
    email: string;
    connected_at: string
};

export interface ActiveConversation {
    entry_id: string;
    entry_type: EntryType;
    campaign_id?: string;
    lead_name: string;
    lead_number: string;
    lead_metadata?: EntryMetadata;
    entry_variables?: string[];
    messages: ConversationMessage[];
    has_more: boolean;
    unread_count: number;
    total?: number;
    window_open: boolean;
    window_expires_at: string | null;
    automation_enabled?: boolean | null;
    conversation_status?: string;
    close_source?: string;
    close_reason?: string;
    closed_at?: string | null;
    ai_handler?: AIHandler | null;
}

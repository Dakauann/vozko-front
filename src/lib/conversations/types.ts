import type { Analysis } from '@/lib/analysis/types';
import type { AdOrigin } from './ad-origin';
import type { MessageCapabilities } from './message-actions';
import type { SenderKind } from './sender';
import type { ViewersPayload } from './viewers';
import type { LiveRead } from '@/lib/live-decisions/types';
import type { LeadsBulkUpdateEvent, LeadUpdateEvent } from '@/lib/leads/types';
import type { TeamChatSocketEvent } from '@/lib/team-chat/types';
import { TIKTOK_TEXT_LIMIT } from '@/lib/tiktok/channel';

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

export type EntryType =
    | 'whatsapp'
    | 'instagram'
    | 'facebook'
    | 'telegram'
    | 'unofficial_whatsapp'
    | 'webchat'
    | 'mercadolivre'
    | 'tiktok';

export type CampaignType = 'whatsapp' | 'unofficial_whatsapp';

export type ContainerKind = 'campaign' | undefined;

export type MessageChannel = 'whatsapp' | 'instagram' | 'facebook' | 'telegram' | 'unofficial_whatsapp' | 'webchat' | 'mercadolivre' | 'tiktok';

export const FILTERABLE_MESSAGE_CHANNELS: readonly MessageChannel[] = [
    'whatsapp',
    'unofficial_whatsapp',
    'instagram',
    'facebook',
    'telegram',
    'webchat',
    'mercadolivre',
    'tiktok',
] as const;

export type WhatsAppCampaignTypeFilter = 'standard' | 'organic';

export type TextLimitUnit = 'characters' | 'bytes';

export type TextCharset = 'mercadolivre';

export interface TextLimit {
    max: number;
    unit: TextLimitUnit;
    charset?: TextCharset;
}

export interface AttachmentRule {
    mimeTypes: readonly string[];
    extensions: readonly string[];
    kinds: readonly string[];
    maxBytes: number;
    voiceNotes: boolean;
}

export type ChannelMediaKind = Exclude<MediaType, 'sticker'>;

export interface ChannelMediaLimit {
    kind: ChannelMediaKind;
    max_bytes: number;
    mime_types: readonly string[];
}

interface ChannelCapabilityRow {
    calling: boolean;
    messageEditing: boolean;
    timedOutboundWindow: boolean;
    aiHandling: boolean;
    textLimit: TextLimit | null;
}

const CHANNEL_CAPABILITIES: Record<EntryType, ChannelCapabilityRow> = {
    whatsapp: { calling: true, messageEditing: false, timedOutboundWindow: true, aiHandling: true, textLimit: null },
    unofficial_whatsapp: { calling: true, messageEditing: true, timedOutboundWindow: false, aiHandling: true, textLimit: null },
    instagram: {
        calling: false,
        messageEditing: false,
        timedOutboundWindow: true,
        aiHandling: true,
        textLimit: { max: 1000, unit: 'bytes' },
    },
    facebook: {
        calling: false,
        messageEditing: false,
        timedOutboundWindow: true,
        aiHandling: true,
        textLimit: { max: 2000, unit: 'characters' },
    },
    telegram: { calling: false, messageEditing: true, timedOutboundWindow: false, aiHandling: true, textLimit: null },
    webchat: { calling: false, messageEditing: false, timedOutboundWindow: false, aiHandling: true, textLimit: null },
    mercadolivre: {
        calling: false,
        messageEditing: false,
        timedOutboundWindow: false,
        aiHandling: true,
        textLimit: { max: 350, unit: 'characters', charset: 'mercadolivre' },
    },
    tiktok: {
        calling: false,
        messageEditing: false,
        timedOutboundWindow: true,
        aiHandling: true,
        textLimit: TIKTOK_TEXT_LIMIT,
    },
};

export function normalizeEntryType(entryType: EntryType): EntryType {
    return entryType;
}

function capabilityRow(entryType: EntryType): ChannelCapabilityRow | null {
    const t = normalizeEntryType(entryType);
    return Object.hasOwn(CHANNEL_CAPABILITIES, t) ? CHANNEL_CAPABILITIES[t] : null;
}

export const channelCapabilities = {
    supportsCalling(entryType: EntryType): boolean {
        return capabilityRow(entryType)?.calling ?? false;
    },

    supportsMessageEditing(entryType: EntryType): boolean {
        return capabilityRow(entryType)?.messageEditing ?? false;
    },

    hasTimedOutboundWindow(entryType: EntryType): boolean {
        return capabilityRow(entryType)?.timedOutboundWindow ?? false;
    },

    supportsAiHandling(entryType: EntryType): boolean {
        return capabilityRow(entryType)?.aiHandling ?? false;
    },

    textLimit(entryType: EntryType): TextLimit | null {
        return capabilityRow(entryType)?.textLimit ?? null;
    },
} as const;

export type MessageType =
    | 'user_message'
    | 'ai_response'
    | 'operator'
    | 'tool_call'
    | 'tool_result'
    | 'audio'
    | 'media'
    | 'system'
    | 'template'
    | 'call_permission_request'
    | 'call_permission_granted'
    | 'call_permission_rejected'
    | 'story_reply'
    | 'story_mention'
    | 'reaction'
    | 'unsupported'
    | 'post_share'
    | 'sticker'
    | 'link_share'
    | 'call_received'
    | 'call_answered'
    | 'call_missed'
    | 'call_ended';

export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';

export interface MediaLayout {
    width: number;
    height: number;
    thumbhash?: string;
}

export interface MatchedMessage {
    message_id: string;
    text: string;
    from: string;
    message_type: MessageType;
    channel: MessageChannel;
    created_at: string;
    position: number;
    page: number;
}

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

export type AnalysisPhase = "awaiting" | "queued";

export interface InboxEntry {
    entry_id: string;
    entry_type: EntryType;
    lead_id?: string;
    lead_version?: number;
    lead_name: string;
    lead_picture?: string;
    lead_number: string;
    is_group?: boolean;
    blocked?: boolean;
    entry_variables?: string[];
    unread_count: number;
    last_message_preview: string;
    last_message_at: string;
    last_message_type: MessageType;
    last_message_sender: string;
    last_message_sender_avatar: string;
    last_message_sender_kind?: SenderKind;
    last_message_author?: string;
    last_message_from_us?: boolean;
    window_open: boolean;
    window_expires_at: string | null;
    window_closed_reason?: WindowClosedReason | null;
    window_closed_detail?: string | null;
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
    analysis_phase?: AnalysisPhase;
    live_read?: LiveRead | null;
    conversation_status?: string;
    close_source?: string;
    close_reason?: string;
    close_outcome?: string;
    closed_at?: string | null;
    ai_handler?: AIHandler | null;
    waiting_since?: string;
}

export interface PersonalMark {
    pinned_at?: string;
    unread_marked_at?: string;
}

export interface PersonalMarkEntry extends PersonalMark {
    entry_id: string;
    entry_type: EntryType;
}

export interface WsPersonalMarkPayload {
    entry_id: string;
    entry_type: EntryType;
    mark: PersonalMark | null;
}

export type InboxSort = 'recent' | 'waiting';

interface TemplateMetadataButton {
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
    channel: MessageChannel;
    message_type: MessageType;
    direction?: 'INBOUND' | 'OUTBOUND';
    sent_by?: { kind: string; id: string } | null;
    from: string;
    to: string;
    text: string;
    media_id?: string;
    media_type?: MediaType;
    media_url?: string;
    media_layout?: MediaLayout;
    sender_name: string;
    sender_avatar?: string;
    read: boolean;
    read_at: string | null;
    read_by: string | null;
    delivery_status?: 'sent' | 'delivered' | 'read' | 'failed';
    reply_to_message_id?: string;
    metadata?: TemplateMessageMetadata;
    location?: MessageLocation;
    client_request_id?: string;
    provider_message_id?: string;
    sender_user_id?: string;
    resent_as?: string;
    reactions?: MessageReaction[];
    edited_at?: string;
    retracted_at?: string;
    transcript?: string;
    local_send?: LocalSend;
    created_at: string;
    updated_at: string;
}

export interface MessageReaction {
    emoji: string;
    direction: 'inbound' | 'outbound';
    actor_id?: string;
    at: string;
}

export interface LocalSend {
    requestId: string;
    state: 'pending' | 'failed';
    failure?: string;
}

export type HistoryDirection = 'latest' | 'before' | 'around' | 'after';

export interface MessageLocation {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
    candidate: boolean;
}

export interface WsSearchInboxPayload {
    query?: string;
    stage_id?: string;
    stage_name?: string;
    min_message_count?: number;
    max_message_count?: number;
    message_search?: string;
    channel?: MessageChannel;
    date_from?: string;
    date_to?: string;
    window_open?: boolean;
    has_unread?: boolean;
    is_group?: boolean;
    conversation_status?: 'new' | 'ongoing' | 'finished';
    responsible_user_id?: string;
    responsible_unassigned?: boolean;
    responsible_kind?: "ai" | "workflow";
    sort?: InboxSort;
    label_id?: string;
    personal?: 'pinned';
    page?: number;
    page_size?: number;
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
    personal_marks?: PersonalMarkEntry[];
}

export interface WsEntryUpdatePayload {
    entry: InboxEntry;
    silent?: boolean;
}

export interface WsSubscribedPayload {
    entry_id: string;
    entry_type: EntryType;
    lead_id?: string;
    lead_version?: number;
    blocked?: boolean;
    lead_name: string;
    lead_number: string;
    lead_picture?: string;
    lead_metadata?: EntryMetadata;
    unread_count: number;
    window_open?: boolean;
    window_expires_at?: string | null;
    window_closed_reason?: WindowClosedReason | null;
    window_closed_detail?: string | null;
    window_tier?: WindowTier;
    automation_enabled?: boolean | null;
    ad_origin?: unknown;
    message_capabilities?: unknown;
    media_limits?: unknown;
}

export interface WsNotePayload {
    entry_id: string;
    entry_type: EntryType;
    note: unknown;
}

export interface WsNoteDeletedPayload {
    entry_id: string;
    entry_type: EntryType;
    note_id: string;
}

export interface WsAdOriginPayload {
    entry_id: string;
    entry_type: EntryType;
    ad_origin: unknown;
}

export interface WsHistoryPayload {
    entry_id: string;
    entry_type: EntryType;
    direction: HistoryDirection;
    messages: ConversationMessage[];
    has_more: boolean;
    has_after: boolean;
    total?: number;
    page_size: number;
}

export interface WsWindowReopenedPayload {
    entry_id: string;
    entry_type: EntryType;
    request_id?: string;
    template_id: string;
    template_name: string;
    message_id: string;
    window_expires_at?: string | null;
}

export interface WsMessageUpdatedPayload {
    entry_id: string;
    entry_type: EntryType;
    message: ConversationMessage;
}

export interface WsMessagePayload {
    entry_id: string;
    entry_type: EntryType;
    message: ConversationMessage;
}

export interface WsMessageSentPayload {
    request_id?: string;
    entry_id: string;
    entry_type: EntryType;
    message: ConversationMessage;
}

export interface WsMessageErrorPayload {
    request_id?: string;
    entry_id: string;
    entry_type: EntryType;
    error: string;
    code?: string;
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

export interface ConversationOutcome {
    code: string;
    label: string;
    isDurable: boolean;
    position: number;
}

export interface WsErrorPayload {
    code: string;
    message: string;
    request_id?: string;
    entry_id?: string;
    entry_type?: EntryType;
    status?: 'new' | 'ongoing' | 'finished';
    previous_status?: 'new' | 'ongoing' | 'finished';
    outcomes?: ConversationOutcome[];
}

export interface PendingOutcomeRequest {
    entryId: string;
    entryType: EntryType;
    status: 'new' | 'ongoing' | 'finished';
    message: string;
    outcomes: ConversationOutcome[];
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
    personal_marks?: PersonalMarkEntry[];
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

type CallStatus = 'ringing' | 'answered' | 'ended' | 'waiting_slot';

export interface WsFunnelColumnPayload {
    stage_id: string;
    entries: InboxEntry[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
}

interface WsFunnelColumnSummary {
    stage_id: string;
    total_items: number;
}

export interface WsFunnelSummaryPayload {
    columns: WsFunnelColumnSummary[];
}

type CallEndReason = 'ended' | 'failed' | 'busy' | 'no_answer' | 'declined';

type CallErrorCode =
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
    close_outcome?: string;
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
    | { type: 'conversation:ad_origin'; payload: WsAdOriginPayload }
    | { type: 'conversation:history'; payload: WsHistoryPayload }
    | { type: 'conversation:message'; payload: WsMessagePayload }
    | { type: 'conversation:message_sent'; payload: WsMessageSentPayload }
    | { type: 'conversation:message_error'; payload: WsMessageErrorPayload }
    | { type: 'conversation:message_updated'; payload: WsMessageUpdatedPayload }
    | { type: 'conversation:window_reopened'; payload: WsWindowReopenedPayload }
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
    | { type: 'conversation:lead_update'; payload: LeadUpdateEvent }
    | { type: 'conversation:leads_bulk_update'; payload: LeadsBulkUpdateEvent }
    | { type: 'notification:created'; payload: unknown }
    | { type: 'conversation:viewers'; payload: ViewersPayload }
    | { type: 'conversation:note'; payload: WsNotePayload }
    | { type: 'conversation:note_deleted'; payload: WsNoteDeletedPayload }
    | { type: 'conversation:personal_mark'; payload: WsPersonalMarkPayload }
    | { type: TeamChatSocketEvent['type']; payload: unknown }
    | { type: 'conversation:error'; payload: WsErrorPayload };

export interface WsAnalysisUpdatePayload {
    entry_id: string;
    entry_type: EntryType;
    analysis?: Analysis | null;
    pending?: boolean;
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

export type WindowTier = '' | 'standard' | 'human_agent';

export type WindowClosedReason =
    | "expired"
    | "no_inbound"
    | "contact_blocked"
    | "session_down"
    | "account_restricted"
    | "reply_revoked"
    | "channel_unavailable"
    | "provider_blocked"
    | "budget_exhausted";

export interface ActiveConversation {
    entry_id: string;
    entry_type: EntryType;
    campaign_id?: string;
    lead_id?: string;
    lead_version?: number;
    blocked?: boolean;
    lead_name: string;
    lead_picture?: string;
    lead_number: string;
    lead_metadata?: EntryMetadata;
    entry_variables?: string[];
    messages: ConversationMessage[];
    has_more: boolean;
    has_after?: boolean;
    held_live?: ConversationMessage[];
    unread_count: number;
    total?: number;
    window_open: boolean;
    window_expires_at: string | null;
    window_closed_reason?: WindowClosedReason | null;
    window_closed_detail?: string | null;
    window_tier?: WindowTier | null;
    automation_enabled?: boolean | null;
    conversation_status?: string;
    close_source?: string;
    close_reason?: string;
    close_outcome?: string;
    closed_at?: string | null;
    ai_handler?: AIHandler | null;
    is_group?: boolean;
    ad_origin?: AdOrigin | null;
    message_capabilities?: MessageCapabilities;
    media_limits?: readonly ChannelMediaLimit[];
}

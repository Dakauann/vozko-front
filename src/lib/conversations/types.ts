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


export type EntryType =
    | 'voice'
    | 'whatsapp'
    | 'sip'
    | 'support'
    | 'instagram'
    | 'telegram'
    /**
     * WhatsApp over a linked-device session rather than Meta's Cloud API.
     *
     * The same channel to a customer, a different transport to us: no template,
     * no 24h window, real delivery receipts, editable messages. It is a separate
     * entry type because the two share nothing on the send path — conflating
     * them would route every reply through the Cloud API's template-and-balance
     * machinery.
     */
    | 'unofficial_whatsapp';

/**
 * Instagram is deliberately absent here.
 *
 * A campaign is an outbound blast, and Instagram forbids cold outbound entirely,
 * a business can only reply inside a 24h window opened by the customer. So there is
 * no Instagram campaign to model, and adding one would invent a capability the
 * platform does not grant.
 */
export type CampaignType = 'voice' | 'whatsapp' | 'support' | 'unofficial_whatsapp';

/**
 * The channel a MESSAGE was carried on, which is what the inbox filters by.
 *
 * Distinct from EntryType: 'sip' and 'support' are entry kinds, not message
 * channels. Declared once because it had been spelled out inline in three
 * places, and each new channel was added to some of them, Telegram reached the
 * inbox with no filter option, and a Telegram message rendered a telephone icon
 * because it fell through the whatsapp/instagram checks to the voice branch.
 */
export type MessageChannel = 'voice' | 'whatsapp' | 'instagram' | 'telegram' | 'unofficial_whatsapp';

/** The channels an operator can filter the inbox by, in display order. */
export const FILTERABLE_MESSAGE_CHANNELS: readonly MessageChannel[] = [
    'whatsapp',
    // Next to the official transport, not at the end: an operator filtering by
    // "WhatsApp" needs to see immediately that there are two, because a reply
    // leaves from a different number depending on which one they pick.
    'unofficial_whatsapp',
    'instagram',
    'telegram',
    'voice',
] as const;

export type WhatsAppCampaignTypeFilter = 'standard' | 'organic';

export function normalizeEntryType(
    entryType: EntryType,
): 'voice' | 'whatsapp' | 'support' | 'instagram' | 'telegram' | 'unofficial_whatsapp' {
    if (entryType === 'sip') return 'voice';
    return entryType as
        | 'voice'
        | 'whatsapp'
        | 'support'
        | 'instagram'
        | 'telegram'
        | 'unofficial_whatsapp';
}

/**
 * What a channel can actually do, in one place.
 *
 * Conversation UI is shared across channels, so a control that only makes sense
 * for one of them must ask here rather than testing the entry type inline,
 * otherwise every new channel means hunting for scattered conditionals, and a
 * control ends up offered for a channel that cannot honour it.
 */
export const channelCapabilities = {
    /**
     * Telephony needs a dialable number. An Instagram contact is an IGSID with
     * no phone number attached, so calling is not merely disabled, it is not a
     * property of the channel.
     */
    supportsCalling(entryType: EntryType): boolean {
        const t = normalizeEntryType(entryType);
        // The unofficial transport's contact IS an E.164 number, unlike an
        // IGSID or a Telegram user id, so the dialer can reach it. This gates
        // the DIALER only; the WhatsApp call-permission flow is a Cloud API
        // feature and stays gated on 'whatsapp' where it is used.
        return t === 'whatsapp' || t === 'voice' || t === 'unofficial_whatsapp';
    },

    /**
     * Whether an already-sent message can be corrected or unsent.
     *
     * Telegram alone permits it: editMessageText works on our own messages, and
     * deleteMessage works for 48 hours. Offering the action on a channel that
     * cannot honour it and then failing is worse than not offering it, which is
     * why this is asked rather than assumed.
     */
    supportsMessageEditing(entryType: EntryType): boolean {
        const t = normalizeEntryType(entryType);
        // Telegram was the first; the unofficial WhatsApp transport is the
        // second, because a linked-device session can edit and delete-for-all
        // where the Cloud API cannot.
        return t === 'telegram' || t === 'unofficial_whatsapp';
    },

    /**
     * Whether the composer's disabled state is a CLOCK.
     *
     * WhatsApp and Instagram close on a 24h timer that reopens by itself when
     * the customer writes again. Telegram in bot mode has no timer at all, the
     * only thing that closes it is the customer blocking the bot, which never
     * reopens on its own. The copy has to differ, so the question is asked here
     * instead of inferred from a missing expiry.
     */
    hasTimedOutboundWindow(entryType: EntryType): boolean {
        const t = normalizeEntryType(entryType);
        // Deliberately NOT the unofficial transport: it has no clock at all.
        // What closes its composer is a dead session, a WhatsApp restriction or
        // a block — none of which reopens by itself, so a countdown would be a
        // lie in all three cases.
        return t === 'whatsapp' || t === 'instagram';
    },

    /**
     * Whether AI agents can attend this conversation.
     *
     * Instagram gained agent attendance through the channel-agnostic AI reply
     * service, which honours the same automation gating as WhatsApp: the
     * account's "enable agent responses" switch, overridden per conversation by
     * the automation toggle an operator flips when taking over.
     */
    supportsAiHandling(entryType: EntryType): boolean {
        const t = normalizeEntryType(entryType);
        return (
            t === 'whatsapp' || t === 'voice' || t === 'support' ||
            t === 'instagram' || t === 'telegram' || t === 'unofficial_whatsapp'
        );
    },
} as const;

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
    // Instagram-specific inbound shapes. A story reply/mention is a real
    // conversational turn that carries the story context in metadata; a reaction
    // and an unsupported message are markers.
    | 'story_reply'
    | 'story_mention'
    | 'reaction'
    | 'unsupported'
    | 'post_share'
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
    channel: MessageChannel;
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
    /**
     * The CONTACT's picture, distinct from last_message_sender_avatar, which
     * is whoever spoke last and becomes the operator's face the moment they
     * reply. The backend has always sent lead_picture; the type never declared
     * it, so every conversation list rendered initials.
     */
    lead_picture?: string;
    lead_number: string;
    /**
     * True when the other side is a GROUP chat rather than a person.
     *
     * Not just a badge. A group has no number to dial, no lead to open and no
     * single person to attribute the thread to, so several affordances have to
     * be suppressed rather than relabelled — blocking, copying the number, and
     * the lead-shaped fields in the context rail all address a person who does
     * not exist here.
     */
    is_group?: boolean;
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
    channel: MessageChannel;
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
    channel?: MessageChannel;
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
    /**
     * The per-conversation automation override, straight from the server.
     *
     * The server has always sent this; the type omitted it, so the subscribe
     * handler read the cached inbox entry instead. That cache is campaign
     * scoped, so a Telegram or Instagram conversation is usually absent from it,
     * the value resolved to null, null is "inherit", and a paused
     * conversation rendered as running.
     */
    automation_enabled?: boolean | null;
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
    /** See InboxEntry.is_group. Mirrored here so an open conversation knows. */
    is_group?: boolean;
}

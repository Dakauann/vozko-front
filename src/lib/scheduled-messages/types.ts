import type { EntryType, MediaType } from "@/lib/conversations/types";

export type ScheduledMessageStatus =
    | "pending"
    | "sending"
    | "sent"
    | "failed"
    | "canceled";

export type ScheduledMessageFailureReason =
    | "window_closed"
    | "entry_unavailable"
    | "provider_error"
    | "dispatch_interrupted"
    | "permission_revoked"
    | "template_unavailable"
    | "contact_ineligible"
    | "insufficient_balance"
    | "billing_unavailable"
    | "outcome_unknown";

export type ScheduledMessageKind = "text" | "template";

export interface ScheduledTemplate {
    id: string;
    name: string;
    preview?: string;
    bodyParams?: string[];
    headerParams?: string[];
}

export interface ScheduledMessage {
    id: string;
    workspaceId: string;
    entryId: string;
    entryType: EntryType;
    createdByUserId: string;

    kind: ScheduledMessageKind;
    template?: ScheduledTemplate;

    text?: string;
    mediaId?: string;
    mediaType?: MediaType;
    replyToMessageId?: string;
    signed: boolean;

    scheduledAt: string;

    status: ScheduledMessageStatus;
    failureReason?: ScheduledMessageFailureReason;
    failureDetail?: string;

    sentAt?: string;
    sentMessageId?: string;

    createdAt: string;
    updatedAt: string;
}

export interface SchedulingWindow {
    open: boolean;
    expiresAt?: string | null;
    latestAllowedAt?: string | null;
    templateLatestAllowedAt?: string | null;
}

export interface ScheduleMessagePayload {
    text: string;
    scheduled_at: string;
    media_id?: string;
    media_type?: MediaType;
    reply_to_message_id?: string;
    signed?: boolean;
}

export interface ScheduleTemplatePayload {
    scheduled_at: string;
    template: {
        template_id: string;
        body_params?: string[];
        header_params?: string[];
    };
}

export type SchedulingErrorCode =
    | "window_closed"
    | "past_window"
    | "too_soon"
    | "too_far"
    | "not_found"
    | "not_pending"
    | "invalid_request"
    | "template_forbidden"
    | "templates_unsupported"
    | "template_params"
    | "template_unavailable"
    | "contact_blocked"
    | "spam_window"
    | "number_unavailable";

export interface SchedulingError {
    message: string;
    code?: SchedulingErrorCode;
    window?: SchedulingWindow;
}

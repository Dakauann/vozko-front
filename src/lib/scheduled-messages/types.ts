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
    | "dispatch_interrupted";

export interface ScheduledMessage {
    id: string;
    workspaceId: string;
    entryId: string;
    entryType: EntryType;
    createdByUserId: string;

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
}

export interface ScheduleMessagePayload {
    text: string;
    scheduled_at: string;
    media_id?: string;
    media_type?: MediaType;
    reply_to_message_id?: string;
    signed?: boolean;
}

export type SchedulingErrorCode =
    | "window_closed"
    | "past_window"
    | "too_soon"
    | "too_far"
    | "not_found"
    | "not_pending"
    | "invalid_request";

export interface SchedulingError {
    message: string;
    code?: SchedulingErrorCode;
    window?: SchedulingWindow;
}

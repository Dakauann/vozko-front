import type { EntryType, MediaType } from "@/lib/conversations/types";

export type ScheduledMessageStatus =
    | "pending"
    | "sending"
    | "sent"
    | "failed"
    | "canceled";

/**
 * Why a scheduled message never reached the customer.
 *
 * `dispatch_interrupted` is the one the UI must NOT render as a plain failure:
 * it means the delivery could not be CONFIRMED — the process died between
 * calling the provider and recording the result — so the message may well have
 * arrived. Telling an operator it failed would invite them to send it twice.
 */
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

    /** UTC, ISO 8601. Rendered in the operator's own timezone. */
    scheduledAt: string;

    status: ScheduledMessageStatus;
    failureReason?: ScheduledMessageFailureReason;
    failureDetail?: string;

    sentAt?: string;
    sentMessageId?: string;

    createdAt: string;
    updatedAt: string;
}

/**
 * What the conversation will accept right now.
 *
 * `latestAllowedAt` is computed by the server and returned rather than derived
 * here, so the date picker and the validator cannot disagree about a boundary —
 * a disagreement the operator would experience as a time the UI offered and the
 * server then refused.
 */
export interface SchedulingWindow {
    open: boolean;
    /**
     * When the messaging window closes. Only a bound when `open` is true: some
     * channels report an expiry while CLOSED (the countdown on a provider
     * restriction), where it means the opposite.
     */
    expiresAt?: string | null;
    latestAllowedAt?: string | null;
}

export interface ScheduleMessagePayload {
    text: string;
    /** RFC3339 with the browser's real offset. The server stores UTC. */
    scheduled_at: string;
    media_id?: string;
    media_type?: MediaType;
    reply_to_message_id?: string;
    signed?: boolean;
}

/** Server refusal codes, mapped to copy the operator can act on. */
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
    /** Present on the refusals that are ABOUT the window, so the UI can snap to the boundary. */
    window?: SchedulingWindow;
}

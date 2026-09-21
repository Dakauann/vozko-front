import type {
    ScheduleMessagePayload,
    ScheduledMessage,
    ScheduledMessageStatus,
    SchedulingError,
    SchedulingErrorCode,
    SchedulingWindow,
} from "@/lib/scheduled-messages/types";

import type { EntryType } from "@/lib/conversations/types";
import { apiClient } from "@/lib/api/browser-client";

interface ScheduledMessageEnvelope {
    scheduledMessage: ScheduledMessage;
    window: SchedulingWindow;
}

interface ScheduledMessageListEnvelope {
    scheduledMessages: ScheduledMessage[];
    window: SchedulingWindow;
}

function toSchedulingError(
    error: { message: string; code?: string },
    window?: SchedulingWindow,
): SchedulingError {
    return {
        message: error.message,
        code: error.code as SchedulingErrorCode | undefined,
        window,
    };
}

export async function listScheduledMessagesAction(
    entryType: EntryType,
    entryId: string,
    statuses?: ScheduledMessageStatus[],
): Promise<{
    scheduledMessages: ScheduledMessage[];
    window: SchedulingWindow | null;
    error?: string;
}> {
    const query = statuses?.length ? `?status=${statuses.join(",")}` : "";
    const response = await apiClient<ScheduledMessageListEnvelope>(
        `/conversations/${entryType}/${entryId}/scheduled-messages${query}`,
        { method: "GET" },
    );

    if (response.error) {
        return { scheduledMessages: [], window: null, error: response.error.message };
    }

    return {
        scheduledMessages: response.data?.scheduledMessages ?? [],
        window: response.data?.window ?? null,
    };
}

export async function scheduleMessageAction(
    entryType: EntryType,
    entryId: string,
    payload: ScheduleMessagePayload,
    idempotencyKey: string,
): Promise<{
    scheduledMessage: ScheduledMessage | null;
    window: SchedulingWindow | null;
    error?: SchedulingError;
}> {
    const response = await apiClient<ScheduledMessageEnvelope>(
        `/conversations/${entryType}/${entryId}/scheduled-messages`,
        {
            method: "POST",
            headers: { "Idempotency-Key": idempotencyKey },
            body: JSON.stringify(payload),
        },
    );

    if (response.error) {
        return {
            scheduledMessage: null,
            window: null,
            error: toSchedulingError(response.error),
        };
    }

    return {
        scheduledMessage: response.data?.scheduledMessage ?? null,
        window: response.data?.window ?? null,
    };
}

export async function rescheduleMessageAction(
    id: string,
    scheduledAt: string,
): Promise<{
    scheduledMessage: ScheduledMessage | null;
    window: SchedulingWindow | null;
    error?: SchedulingError;
}> {
    const response = await apiClient<ScheduledMessageEnvelope>(`/scheduled-messages/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ scheduled_at: scheduledAt }),
    });

    if (response.error) {
        return {
            scheduledMessage: null,
            window: null,
            error: toSchedulingError(response.error),
        };
    }

    return {
        scheduledMessage: response.data?.scheduledMessage ?? null,
        window: response.data?.window ?? null,
    };
}

export async function cancelScheduledMessageAction(
    id: string,
): Promise<{ error?: SchedulingError }> {
    const response = await apiClient<void>(`/scheduled-messages/${id}`, { method: "DELETE" });

    if (response.error) {
        return { error: toSchedulingError(response.error) };
    }
    return {};
}

export const WS_EVENT_CALL_TRANSFER = "call:transfer" as const;
export const WS_EVENT_CALL_TRANSFER_CANCEL = "call:transfer_cancel" as const;
export const WS_EVENT_CALL_TRANSFER_STATUS = "call:transfer_status" as const;

export const MAX_TRANSFER_NOTES = 500;

export const TRANSFER_STATUSES = ["ringing", "queued", "connected", "returned", "ended"] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export type TransferTarget = { kind: "member"; userId: string } | { kind: "queue"; queueId: string };

export interface TransferStatusPayload {
    transfer_id: string;
    call_id: string;
    status: string;
    target_user_id?: string;
    target_name?: string;
    queue_id?: string;
    queue_name?: string;
    reason?: string;
}

export interface CallTransferState {
    transferId: string;
    callId: string;
    status: TransferStatus;
    targetName?: string;
    queueName?: string;
    reason?: string;
}

export interface TransferContextPayload {
    from_user_id?: string;
    from_name?: string;
    queue_id?: string;
    queue_name?: string;
    notes?: string;
}

export interface TransferContext {
    fromUserId?: string;
    fromName?: string;
    queueId?: string;
    queueName?: string;
    notes?: string;
}

export interface PresenceEntry {
    userId: string;
    username?: string;
    busy: boolean;
}

export function transferStateFrom(payload: TransferStatusPayload): CallTransferState | null {
    if (!(TRANSFER_STATUSES as readonly string[]).includes(payload.status)) return null;
    return {
        transferId: payload.transfer_id,
        callId: payload.call_id,
        status: payload.status as TransferStatus,
        targetName: payload.target_name || undefined,
        queueName: payload.queue_name || undefined,
        reason: payload.reason || undefined,
    };
}

export function callEndReasonFor(state: CallTransferState): "transferred" | "caller_hung_up" | null {
    switch (state.status) {
        case "queued":
        case "connected":
            return "transferred";
        case "ended":
            return "caller_hung_up";
        default:
            return null;
    }
}

export function transferMessage(target: TransferTarget, notes: string) {
    const trimmed = notes.trim();
    return {
        target_kind: target.kind,
        ...(target.kind === "member" ? { user_id: target.userId } : { queue_id: target.queueId }),
        ...(trimmed ? { notes: trimmed } : {}),
    };
}

export function transferContextFrom(payload: TransferContextPayload | null | undefined): TransferContext | undefined {
    if (!payload) return undefined;
    const context: TransferContext = {
        fromUserId: payload.from_user_id || undefined,
        fromName: payload.from_name || undefined,
        queueId: payload.queue_id || undefined,
        queueName: payload.queue_name || undefined,
        notes: payload.notes?.trim() || undefined,
    };
    return Object.values(context).some(Boolean) ? context : undefined;
}

export function availableColleagues(presence: PresenceEntry[], selfUserId: string): PresenceEntry[] {
    return presence
        .filter((entry) => entry.userId !== selfUserId && !entry.busy)
        .sort((a, b) => (a.username ?? a.userId).localeCompare(b.username ?? b.userId));
}

export const TRANSFER_ERROR_CODES = [
    "target_unavailable",
    "conversation_out_of_reach",
    "transfer_to_self",
    "transfer_in_progress",
    "queue_not_found",
    "notes_too_long",
    "invalid_target",
    "not_call_owner",
    "call_not_found",
    "no_transfer",
    "no_call_to_transfer",
    "transfer_unavailable",
    "transfer_failed",
] as const;

export type TransferErrorCode = (typeof TRANSFER_ERROR_CODES)[number];

export function transferErrorCode(code: string | null | undefined): TransferErrorCode | null {
    return (TRANSFER_ERROR_CODES as readonly string[]).includes(code ?? "") ? (code as TransferErrorCode) : null;
}



export type DialerTransferKind = "blind" | "attended";

export const WS_EVENT_TRANSFER_INITIATE = "transfer:initiate" as const;
export const WS_EVENT_TRANSFER_ACCEPT = "transfer:accept" as const;
export const WS_EVENT_TRANSFER_DECLINE = "transfer:decline" as const;
export const WS_EVENT_TRANSFER_COMPLETE = "transfer:complete" as const;
export const WS_EVENT_TRANSFER_CANCEL = "transfer:cancel" as const;
export const WS_EVENT_TRANSFER_LIST_TARGETS = "transfer:list_targets" as const;

export interface TransferInitiatePayload {
    call_id: string;
    target_user_id: string;
    kind?: DialerTransferKind;
    note?: string;
}

export interface TransferActionPayload {
    transfer_id: string;
    reason?: string;
}


export const WS_EVENT_TRANSFER_OFFER = "transfer:offer" as const;
export const WS_EVENT_TRANSFER_STARTED = "transfer:started" as const;
export const WS_EVENT_TRANSFER_COMPLETED = "transfer:completed" as const;
export const WS_EVENT_TRANSFER_DECLINED = "transfer:declined" as const;
export const WS_EVENT_TRANSFER_CANCELLED = "transfer:cancelled" as const;
export const WS_EVENT_TRANSFER_CONSULTING = "transfer:consulting" as const;
export const WS_EVENT_TRANSFER_TIMED_OUT = "transfer:timed_out" as const;
export const WS_EVENT_TRANSFER_ERROR = "transfer:error" as const;
export const WS_EVENT_TRANSFER_TARGETS = "transfer:targets" as const;

export const WS_EVENT_DIALER_PRESENCE = "dialer:presence" as const;

export interface DialerPresenceUser {
    user_id: string;
    username?: string;
    busy: boolean;
    has_browser?: boolean;
    has_branch?: boolean;
}

export interface DialerPresencePayload {
    users: DialerPresenceUser[];
}

export interface TransferOfferPayload {
    transfer_id: string;
    call_id: string;
    workspace_id: string;
    initiator_id: string;
    kind: DialerTransferKind;
    note?: string;
    phone_number?: string;
    created_at?: string;
    /** True when this offer is a RECALL: a transfer you initiated failed and the
     * held customer is being returned to you. */
    recall?: boolean;
}

export interface TransferStartedPayload {
    transfer_id: string;
    call_id: string;
    target_user_id?: string;
    initiator_id?: string;
    kind: DialerTransferKind;
    stage?: TransferStage;
    phone_number?: string;
    /** Present on the attach notification of a recall: the call came BACK. */
    recall?: boolean;
}

export interface TransferTerminalPayload {
    transfer_id: string;
    call_id?: string;
    reason?: string;
    stage?: TransferStage;
}

export interface TransferConsultingPayload {
    transfer_id: string;
    call_id: string;
    role: "initiator" | "target";
    initiator_id: string;
    target_user_id: string;
}

export interface TransferTimedOutPayload {
    transfer_id: string;
    call_id?: string;
}

export type TransferErrorCode =
    | "transfer_unavailable"
    | "invalid_payload"
    | "missing_fields"
    | "unauthorized"
    | "target_offline"
    | "target_busy"
    | "self_transfer"
    | "call_not_found"
    | "not_owner"
    | "transfer_not_found"
    | "not_for_user"
    | "already_in_flight"
    | "invalid_kind"
    | "invalid_stage"
    | "timed_out"
    | "transfer_failed";

export interface TransferErrorPayload {
    transfer_id?: string;
    call_id?: string;
    code: TransferErrorCode | string;
    message: string;
}

export interface TransferTargetUser {
    user_id: string;
    username?: string;
}

export interface TransferTargetsPayload {
    users: TransferTargetUser[];
}

export interface TransferTargetEntry {
    userId: string;
    username?: string;
}


export type TransferStage =
    | "pending_offer"
    | "consulting"
    | "completing"
    | "recalling"
    | "completed"
    | "declined"
    | "cancelled"
    | "timed_out"
    | "recalled"
    | "failed";

export interface OutgoingTransferState {
    transferId: string;
    callId: string;
    targetUserId: string;
    kind: DialerTransferKind;
    stage: TransferStage;
    startedAt: number;
}

export interface IncomingTransferOffer {
    transferId: string;
    callId: string;
    initiatorId: string;
    kind: DialerTransferKind;
    note?: string;
    phoneNumber?: string;
    receivedAt: number;
    /** A failed transfer being returned to its initiator (the held customer
     * comes back to you when you accept). */
    recall?: boolean;
}

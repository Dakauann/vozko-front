
export const WS_EVENT_INCOMING_CALL = "call:incoming" as const;
export const WS_EVENT_INCOMING_CALL_ACCEPT = "call:incoming_accept" as const;
export const WS_EVENT_INCOMING_CALL_DECLINE = "call:incoming_decline" as const;

export interface IncomingCallPayload {
    offer_id: string;
    call_id: string;
    workspace_id: string;
    trunk_id: string;
    from_number: string;
    to_number?: string;
    channel?: string;
    expires_at: string;
}

export interface IncomingCallOffer {
    offerId: string;
    callId: string;
    workspaceId: string;
    trunkId: string;
    fromNumber: string;
    toNumber?: string;
    channel?: string;
    expiresAt?: string;
    receivedAt: number;
}
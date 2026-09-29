
export const WS_EVENT_INCOMING_CALL = "call:incoming" as const;
export const WS_EVENT_INCOMING_CALL_ACCEPT = "call:incoming_accept" as const;
export const WS_EVENT_INCOMING_CALL_DECLINE = "call:incoming_decline" as const;
export const WS_EVENT_INCOMING_CALL_WITHDRAWN = "call:incoming_withdrawn" as const;

export interface IncomingCallPayload {
    offer_id: string;
    call_id: string;
    workspace_id: string;
    from_number: string;
    to_number?: string;
    channel?: string;
    expires_at: string;
}

export interface IncomingCallOffer {
    offerId: string;
    callId: string;
    workspaceId: string;
    fromNumber: string;
    toNumber?: string;
    channel?: string;
    expiresAt?: string;
    receivedAt: number;
}

export interface IncomingCallWithdrawnPayload {
    offer_id: string;
    reason?: string;
}

export function offerExpiresInMs(offer: IncomingCallOffer, now: number): number | null {
    if (!offer.expiresAt) return null;
    const expiresAt = Date.parse(offer.expiresAt);
    if (Number.isNaN(expiresAt)) return null;
    return Math.max(0, expiresAt - now);
}

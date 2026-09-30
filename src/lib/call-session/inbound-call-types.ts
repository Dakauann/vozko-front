import type { TransferContext, TransferContextPayload } from "@/lib/call-session/transfer";

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
    transfer?: TransferContextPayload;
    resume?: boolean;
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
    transfer?: TransferContext;
    resume?: boolean;
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

export function offerRingShare(offer: IncomingCallOffer, now: number): number | null {
    const remaining = offerExpiresInMs(offer, now);
    const lifetime = remaining === null ? 0 : Date.parse(offer.expiresAt ?? "") - offer.receivedAt;
    if (remaining === null || lifetime <= 0) return null;
    return Math.min(1, remaining / lifetime);
}

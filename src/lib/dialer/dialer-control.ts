"use client";

import { useSyncExternalStore } from "react";


export interface DialerCallRequest {
    phoneNumber: string;
    sipTrunkId?: string;
    whatsAppPhoneId?: string;
    whatsAppPhoneLabel?: string;
}

type RequestListener = (request: DialerCallRequest) => void;
type ActiveListener = (active: boolean) => void;

const requestListeners = new Set<RequestListener>();
const activeListeners = new Set<ActiveListener>();

let active = false;

export function requestDialerCall(request: DialerCallRequest): void {
    requestListeners.forEach((listener) => {
        try {
            listener(request);
        } catch (err) {
            console.error("[dialer-control] request listener failed:", err);
        }
    });
}

export function subscribeDialerCallRequest(listener: RequestListener): () => void {
    requestListeners.add(listener);
    return () => {
        requestListeners.delete(listener);
    };
}

export function setDialerCallActive(next: boolean): void {
    if (active === next) return;
    active = next;
    activeListeners.forEach((listener) => {
        try {
            listener(active);
        } catch (err) {
            console.error("[dialer-control] active listener failed:", err);
        }
    });
}

function subscribeActive(listener: () => void): () => void {
    const wrapped: ActiveListener = () => listener();
    activeListeners.add(wrapped);
    return () => {
        activeListeners.delete(wrapped);
    };
}

function getActiveSnapshot(): boolean {
    return active;
}

function getServerSnapshot(): boolean {
    return false;
}

export function useDialerCallActive(): boolean {
    return useSyncExternalStore(subscribeActive, getActiveSnapshot, getServerSnapshot);
}

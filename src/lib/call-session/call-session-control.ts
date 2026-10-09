"use client";

import { useEffect, useSyncExternalStore } from "react";


export interface CallRequest {
    phoneNumber: string;
    whatsAppPhoneId?: string;
    trunkId?: string;
    leadId?: string;
    callListItemId?: string;
    requestId?: string;
    label?: string;
}

type RequestListener = (request: CallRequest) => void;
type ActiveListener = (active: boolean) => void;

const requestListeners = new Set<RequestListener>();
const activeListeners = new Set<ActiveListener>();

let active = false;

export function requestCall(request: CallRequest): void {
    requestListeners.forEach((listener) => {
        try {
            listener(request);
        } catch (err) {
            console.error("[call-session-control] request listener failed:", err);
        }
    });
}

export function subscribeCallRequest(listener: RequestListener): () => void {
    requestListeners.add(listener);
    return () => {
        requestListeners.delete(listener);
    };
}

export function setCallActive(next: boolean): void {
    if (active === next) return;
    active = next;
    activeListeners.forEach((listener) => {
        try {
            listener(active);
        } catch (err) {
            console.error("[call-session-control] active listener failed:", err);
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

export function useCallActive(): boolean {
    return useSyncExternalStore(subscribeActive, getActiveSnapshot, getServerSnapshot);
}

export type CallSurfaceOwner = "dialer" | "call_list";

const surfaceListeners = new Set<() => void>();
let surfaceClaims: readonly CallSurfaceOwner[] = [];

function publishSurfaceClaims(next: readonly CallSurfaceOwner[]): void {
    surfaceClaims = next;
    surfaceListeners.forEach((listener) => listener());
}

export function setCallSurface(owner: CallSurfaceOwner): void {
    if (callSurfaceOwner() === owner) return;
    publishSurfaceClaims([...surfaceClaims.filter((claim) => claim !== owner), owner]);
}

export function releaseCallSurface(owner: CallSurfaceOwner): void {
    if (!surfaceClaims.includes(owner)) return;
    publishSurfaceClaims(surfaceClaims.filter((claim) => claim !== owner));
}

export function callSurfaceOwner(): CallSurfaceOwner | null {
    return surfaceClaims[surfaceClaims.length - 1] ?? null;
}

function subscribeCallSurface(listener: () => void): () => void {
    surfaceListeners.add(listener);
    return () => {
        surfaceListeners.delete(listener);
    };
}

export function useCallSurfaceOwner(): CallSurfaceOwner | null {
    return useSyncExternalStore(subscribeCallSurface, callSurfaceOwner, () => null);
}

export function useCallSurfaceClaim(owner: CallSurfaceOwner, claimed: boolean): void {
    useEffect(() => {
        if (!claimed) return;
        setCallSurface(owner);
        return () => releaseCallSurface(owner);
    }, [owner, claimed]);
}

export function setDialerOpen(next: boolean): void {
    if (next) setCallSurface("dialer");
    else releaseCallSurface("dialer");
}

export interface DialPreset {
    phoneNumber: string;
    trunkId?: string;
    leadId?: string;
    leadRevision?: number;
}

type PresetListener = (preset: DialPreset) => void;

const presetListeners = new Set<PresetListener>();

export function presetDial(preset: DialPreset): void {
    presetListeners.forEach((listener) => {
        try {
            listener(preset);
        } catch (err) {
            console.error("[call-session-control] preset listener failed:", err);
        }
    });
}

export function subscribeDialPreset(listener: PresetListener): () => void {
    presetListeners.add(listener);
    return () => {
        presetListeners.delete(listener);
    };
}

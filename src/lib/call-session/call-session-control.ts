"use client";

import { useSyncExternalStore } from "react";


export interface CallRequest {
    phoneNumber: string;
    whatsAppPhoneId?: string;
    trunkId?: string;
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

const dialerListeners = new Set<() => void>();
let dialerOpen = false;

export function setDialerOpen(next: boolean): void {
    if (dialerOpen === next) return;
    dialerOpen = next;
    dialerListeners.forEach((listener) => listener());
}

function subscribeDialerOpen(listener: () => void): () => void {
    dialerListeners.add(listener);
    return () => {
        dialerListeners.delete(listener);
    };
}

export function useDialerOpen(): boolean {
    return useSyncExternalStore(subscribeDialerOpen, () => dialerOpen, () => false);
}

export interface DialPreset {
    phoneNumber: string;
    trunkId?: string;
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

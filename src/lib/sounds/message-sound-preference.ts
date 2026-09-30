import { useSyncExternalStore } from "react";

const STORAGE_KEY = "crm_sound_muted";
const listeners = new Set<() => void>();

function read(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
        return false;
    }
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
    };
}

export function messageSoundsMuted(): boolean {
    return typeof window !== "undefined" && read();
}

export function setMessageSoundsMuted(muted: boolean): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, String(muted));
    } catch {
        return;
    }
    listeners.forEach((listener) => listener());
}

export function useMessageSoundsMuted(): boolean {
    return useSyncExternalStore(subscribe, read, () => false);
}

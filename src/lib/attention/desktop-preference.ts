import { useSyncExternalStore } from "react";

const STORAGE_KEY = "crm_desktop_alerts_off";
const listeners = new Set<() => void>();

export type DesktopAlertsState = NotificationPermission | "unsupported";

function notificationApi(): typeof Notification | null {
  if (typeof window === "undefined") return null;
  const api = (window as { Notification?: typeof Notification }).Notification;
  return api ?? null;
}

function turnedOff(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function desktopPermission(): DesktopAlertsState {
  return notificationApi()?.permission ?? "unsupported";
}

export function desktopAlertsAllowed(): boolean {
  return desktopPermission() === "granted" && !turnedOff();
}

export function setDesktopAlertsOff(off: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(off));
  } catch {
    return;
  }
  notify();
}

export async function enableDesktopAlerts(): Promise<DesktopAlertsState> {
  const api = notificationApi();
  if (!api) return "unsupported";
  const permission = api.permission === "default" ? await api.requestPermission() : api.permission;
  if (permission === "granted") setDesktopAlertsOff(false);
  notify();
  return permission;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", listener);
  };
}

function snapshot(): string {
  return `${desktopPermission()}|${turnedOff()}`;
}

export function useDesktopAlerts(): { permission: DesktopAlertsState; enabled: boolean } {
  const value = useSyncExternalStore(subscribe, snapshot, () => "unsupported|false");
  const [permission, off] = value.split("|") as [DesktopAlertsState, string];
  return { permission, enabled: permission === "granted" && off !== "true" };
}
